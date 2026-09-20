#!/usr/bin/env python3
"""
classify-card-spending.py — READ ONLY. Proposes a GL account for every 2025
card purchase, cash withdrawal and bank charge, and writes the proposal out for
review. It posts nothing.

Scope: the 645 debit lines that are NOT outward transfers — 363,657.30. The
transfers are handled separately because ADCB does not name their beneficiary.

Three things are deliberately EXCLUDED rather than classified:

  * The four twofour54 cheques that bounced. Each appears as a debit
    (PDC I/W CLEARING) immediately reversed by a credit (CHQ RETRN: Insufficient
    Funds). They net to nothing and were never a cost - the rent was paid by
    card instead. Treating the debit as rent would invent 51,409.00 of expense.
  * The 15,000.00 salary of 30 December, already charged by JE-2026-0418.
  * Anything that cannot be recognised, which is reported rather than guessed.

Two things are flagged rather than classified, because they are judgement calls
that belong to the General Manager, not to a rule:

  * ATM withdrawals - business cost or drawings.
  * Purchases that look personal, and large purchases that may be equipment
    (capital) rather than expense.

    python3 classify-card-spending.py /tmp/adcb-2025.csv
    python3 classify-card-spending.py /tmp/adcb-2025.csv --detail "Review"
"""

import argparse
import csv
import re
import sys
from collections import defaultdict

# --------------------------------------------------------------------------
# The map. Each entry: (GL code, label, [merchant fragments, upper case]).
# Order matters - the first match wins, so put the specific before the general.
# --------------------------------------------------------------------------

RULES = [
    # Money paid to the Federal Tax Authority is not an expense at all: it is
    # the VAT liability being settled.
    ("2100", "VAT paid to the FTA", ["FEDERAL TA"]),

    # Rent and licence. twofour54 is the landlord and the licensing authority.
    ("6100", "Rent & licence", ["TWOFOUR54", "TWOFOUR 54", "TWOFOUR54FZ"]),
    ("6100", "Utilities & telecom", [
        "ETISALAT", "E& DIGITAL", "SEWA", "ADDC", "DEWA", "ORANGE AMMAN",
        "ROYAL PHON", "Q MOBILITY",
    ]),

    # Vehicles and fuel.
    ("5100", "Fuel", ["ADNOC", "ENOC", "EPPCO", "EMARAT"]),
    ("5100", "Taxi, ride-hailing & tolls", [
        "YANGO", "UBER", "AMAN TAXI", "CARS TAXI", "ARABIA TAX", "EMIRATES T",
        "NATIONAL T", "SKY WAY TR", "VIP VALET", "DARB", "SALIK", "MAWAQIF",
        "TAWASUL TR", "AL GHAZAL",
    ]),
    ("5100", "Air travel & hotels", [
        "WIZZ AIR", "EMIRATES A", "ETIHAD", "LA QUINTA", "HOLIDAY IN",
        "KEM PRAHA", "BOOKING", "AIRBNB",
    ]),
    ("5200", "Vehicle maintenance & parts", [
        "SPORT CAR", "TCA AUTO G", "2 AUTO SER", "MISTER CAR", "PRICELESS AUTO",
        "POPULAR AU", "THE PARTS", "FORMULA TY", "DEXOL", "OVER DRIVE",
        "HIGH QUALI", "ALAM RADIA",
    ]),

    # Equipment, tools and consumables bought on the card.
    ("6200", "Equipment & supplies", [
        "SANA ELECT", "DHABI ONE", "ACE-YAS", "HARDWARE M", "AL SHATRY",
        "ALSHATRY", "APEX TRADI", "FOCUS ELEC", "FEDERAL EL", "ADARC COMP",
        "G T 8 GENE", "LINSHA BLD", "INTEGRATED", "ABDULLAH S", "HEARTLAND",
        "AL MESFER", "NEW GOLDEN", "ARD ALKHAL", "THE LIGHTH", "ADMM LLC",
    ]),
    ("6200", "Online retail & shipping", [
        "AMAZON", "AMZN", "NOON E-COM", "DESERTCART", "JASHANMAL", "EBAY",
        "UPS*", "BETTER LIF", "CARREFOUR", "LULU", "CHOITH", "NAS GIFT",
    ]),

    # Software and subscriptions.
    ("6900", "Software & subscriptions", [
        "ADOBE", "GOOGLE", "MICROSOFT", "MIDJOURNEY", "ELEMENTOR", "GODADD",
        "WETRANSFER", "OPENAI", "ANTHROPIC", "DROPBOX", "CANVA", "SMART DUBA",
    ]),

    # Meals, hospitality and anything bought to feed a crew.
    ("5000", "Crew meals & hospitality", [
        "TALABAT", "FOOD NATIO", "ROYAL CATE", "CATERING", "POPEYES",
        "IDIOMS RES", "TROVE REST", "DENNYS RES", "HUQQABAZ", "AL MANDI",
        "UGARIT", "CHEF ELMAN", "SPOT BURGE", "FIRAS AL D", "TEXAS CHIC",
        "BROASTED A", "RITAJ REST", "AFGHAN ZAM", "MONDOUX RE", "KATRINA SW",
        "AL SHURFA", "AL AIN AHL", "ABUL NAWAS", "BAIT AL SH", "ALMUQADDAR",
        "CORNER DAY", "SEA SHELL", "TEA TIME C", "HARDEES", "GREEN MARI",
        "FRESH KART", "BAQALA MAR", "CARRYONE H", "HOUSE OF T", "PECANNBEE",
        "ZONE CORNE", "MANGO MARK", "AL FARAH R", "BOSPORUSAB", "DREAM WAY",
        "1360-LIFE", "LEVEL ONE", "FARAH EXPE", "BEACH WAY",
        "EMIRATES H", "EMIRATES L", "DSC BOUTIQ", "MOHAMM", "ALDAMAN PH",
        "CANADIAN V",
    ]),

    # Bank's own charges.
    ("6500", "Bank charges", [
        "SERVICEFEE", "SERVICE FEE", "CHEQUE RETURN CHARGE", "CASH WDL CHG",
        "SW DCL FEE", "FOREIGN TRANSACTION FEE", "OVERDRAFT", "PROFIT RATE",
    ]),

    # Government and regulator.
    ("6200", "Government fees", [
        "TRADE LICENSE FEE", "SAAED FOR", "DUBAI INSU", "SOCIAL CONTRIBUTION",
        "MUNICIPAL", "IMMIGRATION",
    ]),
]

# Held back for the General Manager rather than classified.
CASH = ["ATM WDL"]
EXCLUDE = [
    ("PDC I/W CLEARING", "twofour54 cheque that bounced - reversed by the return credit"),
    ("PDC CHQ RETRN", "the reversal of a bounced cheque"),
    ("SALARY 43333003", "already charged by JE-2026-0418"),
]
# Recognised, but the treatment is a judgement call.
REVIEW = [
    ("TAMARA", "buy-now-pay-later instalments - what was bought, and when?"),
    ("ABU DHABI AUH", "unclear merchant - airport, or Abu Dhabi Media?"),
    ("NETFLIX", "streaming - personal unless there is a business reason"),
    ("VAPORS R U", "vape shop - looks personal"),
    ("HENNES&MAU", "clothing - looks personal"),
    ("TLR*SHORY", "insurance - confirm which vehicle or policy"),
    ("SANA ELECT", "13,250 of electronics - may be equipment (capital), not expense"),
    ("FORMULA TY", "9,990 of tyres - confirm which vehicle"),
    ("DHABI ONE", "9,750 - confirm what was bought"),
    ("ABDULLAH S", "9,100 - confirm what was bought"),
    ("HEARTLAND", "8,410 - confirm what was bought"),
    ("THE PARTS", "3,703 of parts from the USA - confirm the vehicle"),
    ("WIZZ AIR", "flights - confirm the trip was for the business"),
    ("KEM PRAHA", "4,653 in Prague - confirm the trip was for the business"),
]


def money(n):
    return f"{n:,.2f}"


def clean(narrative):
    text = re.sub(r"^\d{2}/\d{2}/\d{4}\s*", "", narrative)
    text = re.sub(r"\s+\d{2}/\d{2}/\d{4}.*$", "", text)
    return " ".join(text.split())


def classify(narrative):
    """Returns (code, label, status) where status is one of
    posted / cash / review / excluded / unknown."""
    upper = narrative.upper()

    for needle, reason in EXCLUDE:
        if needle.upper() in upper:
            return (None, reason, "excluded")

    # Cash is tested before the merchant rules: an ATM withdrawal is a cash
    # withdrawal whatever the branch happens to be called. ("EMIRATES BANK
    # INTL ABU DHABI AUHAE" otherwise trips the Abu Dhabi merchant rule.)
    for needle in CASH:
        if needle.upper() in upper:
            return (None, "cash withdrawn - business cost or drawings?", "cash")

    for needle, reason in REVIEW:
        if needle.upper() in upper:
            return (None, reason, "review")

    for code, label, needles in RULES:
        for needle in needles:
            if needle.upper() in upper:
                return (code, label, "posted")

    return (None, "not recognised", "unknown")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("csvfile")
    parser.add_argument("--detail", help="list every line in this status or label")
    parser.add_argument("--out", help="write the classified rows to this CSV")
    args = parser.parse_args()

    with open(args.csvfile, newline="") as handle:
        rows = [r for r in csv.DictReader(handle) if r["direction"] == "DEBIT"]

    rows = [r for r in rows
            if not re.search(r"O/W TRF|TRF TO|OUTWARD", r["narrative"], re.I)]

    if not rows:
        sys.exit("no non-transfer debits found - check the CSV path")

    buckets = defaultdict(lambda: {"n": 0, "total": 0.0})
    status_totals = defaultdict(lambda: {"n": 0, "total": 0.0})
    classified = []

    for row in rows:
        narrative = clean(row["narrative"])
        value = float(row["amount"])
        code, label, status = classify(narrative)
        key = (status, code or "-", label)
        buckets[key]["n"] += 1
        buckets[key]["total"] += value
        status_totals[status]["n"] += 1
        status_totals[status]["total"] += value
        classified.append({
            "date": row["date"],
            "amount": f"{value:.2f}",
            "status": status,
            "gl": code or "",
            "label": label,
            "narrative": narrative,
        })

    grand = sum(float(r["amount"]) for r in rows)
    print(f"=== {len(rows)} CARD, CASH AND CHARGE LINES — {money(grand)} ===\n")

    order = ["posted", "review", "cash", "excluded", "unknown"]
    for status in order:
        entries = {k: v for k, v in buckets.items() if k[0] == status}
        if not entries:
            continue
        head = status_totals[status]
        print(f"--- {status.upper()}  ({head['n']} lines, {money(head['total'])}) ---")
        for (_s, code, label), data in sorted(entries.items(), key=lambda kv: -kv[1]["total"]):
            print(f"  {code:<6}{label[:52]:<54}{data['n']:>4}  {money(data['total']):>12}")
        print()

    print("=== WHAT THIS WOULD DO TO 2025 ===\n")
    by_account = defaultdict(float)
    for (status, code, _label), data in buckets.items():
        if status == "posted":
            by_account[code] += data["total"]
    for code, total in sorted(by_account.items()):
        print(f"  {code}  {money(total):>13}")
    print(f"\n  ready to post now      {money(status_totals['posted']['total']):>13}")
    print(f"  needs a decision       "
          f"{money(status_totals['review']['total'] + status_totals['cash']['total']):>13}")
    print(f"  correctly excluded     {money(status_totals['excluded']['total']):>13}")
    print(f"  not recognised         {money(status_totals['unknown']['total']):>13}")

    if args.detail:
        want = args.detail.lower()
        print(f"\n=== DETAIL: {args.detail} ===\n")
        for row in sorted(classified, key=lambda r: -float(r["amount"])):
            if want in row["status"].lower() or want in row["label"].lower():
                print(f"  {row['date']}  {float(row['amount']):>11,.2f}  "
                      f"{row['label'][:40]:<42}{row['narrative'][:60]}")

    if args.out:
        with open(args.out, "w", newline="") as handle:
            writer = csv.DictWriter(
                handle, fieldnames=["date", "amount", "status", "gl", "label", "narrative"]
            )
            writer.writeheader()
            writer.writerows(classified)
        print(f"\n  wrote {len(classified)} classified lines to {args.out}")

    print("\n  Nothing has been posted.")


if __name__ == "__main__":
    main()
