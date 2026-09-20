#!/usr/bin/env python3
"""
extract-adcb-transactions.py — READ ONLY. Turns the ADCB statement PDFs into a
transaction list and proves the parse against the bank's own running balance.

The statements print debit and credit in the same text flow, so the amount alone
does not say which it is. The running balance does: if the balance fell by the
amount it is a debit, if it rose it is a credit. Every line is checked that way,
and any line that does not reconcile is reported rather than guessed at. A month
is only trusted when its parsed lines walk from the opening balance to the
closing balance exactly.

    python3 extract-adcb-transactions.py --year 2025
    python3 extract-adcb-transactions.py --year 2025 --csv out.csv
    python3 extract-adcb-transactions.py --year 2025 --debits --by-category
"""

import argparse
import csv
import hashlib
import os
import re
import sys
from collections import defaultdict

try:
    from pypdf import PdfReader
except ImportError:  # pragma: no cover
    sys.exit("pypdf is not installed: python3 -m pip install --user pypdf")

ROOTS = [
    os.path.expanduser("~/Downloads/ADCB 2025"),
    os.path.expanduser("~/Documents"),
    os.path.expanduser("~/Desktop"),
]

DATE = re.compile(r"^(\d{2}/\d{2}/\d{4})\b")
# The balance column goes negative when a cheque clears against insufficient
# funds, so the minus sign has to be part of the number or the row reads as a
# credit when it was a debit.
NUM = re.compile(r"-?\d{1,3}(?:,\d{3})*\.\d{2}")
# The last row of every page has the statement's own column totals and page
# furniture glued onto it. Cut them off before reading the amounts.
TRAILER = re.compile(
    r"\s+(?:Total\s+-?\d|End Of Statement|Page \d+ of \d+|Transactions Details)",
    re.IGNORECASE,
)
CENTS = 0.005


def money(n):
    return f"{n:,.2f}"


def amount(text):
    return float(text.replace(",", ""))


def statement_paths():
    """Every distinct ADCB statement PDF, de-duplicated on its bytes."""
    seen = set()
    out = []
    for root in ROOTS:
        if not os.path.isdir(root):
            continue
        for dirpath, _dirs, names in os.walk(root):
            for name in names:
                low = name.lower()
                if ("adcbstmt" not in low and "e-statement" not in low):
                    continue
                if not low.endswith(".pdf"):
                    continue
                path = os.path.join(dirpath, name)
                with open(path, "rb") as handle:
                    key = hashlib.sha256(handle.read()).hexdigest()
                if key in seen:
                    continue
                seen.add(key)
                out.append(path)
    return sorted(out)


def statement_text(path):
    try:
        reader = PdfReader(path)
        if reader.is_encrypted and reader.decrypt("") == 0:
            return None
        return "\n".join((page.extract_text() or "") for page in reader.pages)
    except Exception:  # noqa: BLE001
        return None


def logical_lines(text):
    """
    Re-join the wrapped rows. A row starts with a date; anything after it that
    does not start with a date belongs to the row above.
    """
    rows = []
    current = None
    for raw in text.splitlines():
        line = " ".join(raw.split())
        if not line:
            continue
        if DATE.match(line):
            if current:
                rows.append(current)
            current = line
        elif current is not None:
            current = f"{current} {line}"
    if current:
        rows.append(current)
    return rows


def parse_statement(text):
    """
    Returns (transactions, opening, closing, problems).

    Direction comes from the balance movement, never from column position.
    """
    rows = logical_lines(text)
    transactions = []
    problems = []
    balance = None
    opening = None

    for row in rows:
        cut = TRAILER.search(row)
        if cut:
            row = row[: cut.start()]
        date = DATE.match(row).group(1)
        numbers = NUM.findall(row)
        if not numbers:
            continue

        if balance is None:
            # The B/F row carries one figure: the opening balance.
            if "B/F" in row.upper():
                opening = balance = amount(numbers[-1])
            continue

        if len(numbers) < 2:
            continue

        new_balance = amount(numbers[-1])
        value = amount(numbers[-2])
        delta = new_balance - balance

        if abs(delta + value) < CENTS:
            direction = "DEBIT"
        elif abs(delta - value) < CENTS:
            direction = "CREDIT"
        else:
            problems.append(f"{date}  balance moved {money(delta)} but the amount read {money(value)}  |  {row[:110]}")
            balance = new_balance
            continue

        # Strip the trailing numeric columns out of the narrative.
        narrative = row
        for token in numbers[-2:]:
            narrative = narrative.replace(token, " ")
        narrative = " ".join(narrative.split())

        transactions.append({
            "date": date,
            "direction": direction,
            "amount": value,
            "balance": new_balance,
            "narrative": narrative,
        })
        balance = new_balance

    return transactions, opening, balance, problems


CATEGORIES = [
    ("Salaries & owner", ("SALARY", "WPS", "PAYROLL")),
    ("Cash withdrawn", ("ATM", "CASH WDL", "CDM-CASH")),
    ("Fuel", ("ADNOC", "ENOC", "EPPCO", "EMARAT")),
    ("Food & delivery", ("TALABAT", "FOOD NATIO", "CAREEM", "DELIVEROO", "NOON FOOD",
                         "POPEYES", "MCDONALD", "KFC", "RESTAURANT", "CAFE", "CATERING",
                         "AL MANDI", "IDIOMS RES", "CHEF ELMAN", "SPOT BURGE", "UGARIT")),
    ("Taxi & transport", ("YANGO", "UBER", "TAXI", "CAREEM RIDE", "SALIK", "PARKING",
                          "DARB", "MAWAQIF")),
    ("Bank charges", ("CHARGE", "CHG", "FEE", "COMMISSION", "VAT ON")),
    ("Transfers out", ("O/W TRF", "TRF TO", "OUTWARD")),
    ("Cheques paid", ("CHQ PAID", "CHEQUE PAID", "PDC O/W")),
    ("Government & fees", ("GOVERNMENT", "MINISTRY", "MUNICIPAL", "TAWASUL", "AL GHAZAL",
                           "EMIRATES ID", "IMMIGRATION", "TAX")),
    ("Telecom & utilities", ("ETISALAT", "DU ", "E& ", "ADDC", "DEWA", "ROYAL PHONE")),
    ("Subscriptions & online", ("GOOGLE", "APPLE", "ADOBE", "MICROSOFT", "AMAZON", "NETFLIX",
                                "OPENAI", "ANTHROPIC", "DESERTCART", "NOON", "AMZN")),
]


def categorise(narrative):
    upper = narrative.upper()
    for label, needles in CATEGORIES:
        for needle in needles:
            if needle in upper:
                return label
    return "Unclassified"


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--year", default="2025")
    parser.add_argument("--csv", help="write every transaction to this file")
    parser.add_argument("--debits", action="store_true", help="only money going out")
    parser.add_argument("--by-category", action="store_true")
    parser.add_argument("--top", type=int, default=0, help="show the N largest")
    args = parser.parse_args()

    months = {}
    all_rows = []
    skipped = []

    for path in statement_paths():
        text = statement_text(path)
        if text is None:
            continue
        transactions, opening, closing, problems = parse_statement(text)
        if not transactions or opening is None:
            continue
        month = transactions[0]["date"][6:10] + "-" + transactions[0]["date"][3:5]
        if not month.startswith(args.year):
            continue
        # Keep the fuller parse when the same month appears twice.
        if month in months and len(months[month]["rows"]) >= len(transactions):
            continue
        months[month] = {
            "rows": transactions,
            "opening": opening,
            "closing": closing,
            "problems": problems,
            "file": os.path.basename(path),
        }

    if not months:
        sys.exit(f"no readable statements found for {args.year}")

    print(f"=== PARSE CHECK, {args.year} ===\n")
    print("  month     lines        opening        closing      in           out      walks?")
    total_in = total_out = 0.0
    for month in sorted(months):
        data = months[month]
        rows = data["rows"]
        got_in = sum(r["amount"] for r in rows if r["direction"] == "CREDIT")
        got_out = sum(r["amount"] for r in rows if r["direction"] == "DEBIT")
        walked = data["opening"] + got_in - got_out
        ok = abs(walked - data["closing"]) < CENTS
        total_in += got_in
        total_out += got_out
        print(
            f"  {month}  {len(rows):5d}  {money(data['opening']):>13}  {money(data['closing']):>13}"
            f"  {money(got_in):>12}  {money(got_out):>12}   {'yes' if ok else 'NO'}"
        )
        if data["problems"]:
            print(f"           {len(data['problems'])} line(s) did not reconcile:")
            for problem in data["problems"][:4]:
                print(f"             {problem}")
        all_rows.extend({**r, "month": month} for r in rows)

    print(f"\n  TOTAL IN  {money(total_in)}")
    print(f"  TOTAL OUT {money(total_out)}")

    rows = [r for r in all_rows if r["direction"] == "DEBIT"] if args.debits else all_rows

    if args.by_category:
        buckets = defaultdict(lambda: {"n": 0, "total": 0.0})
        for row in rows:
            bucket = buckets[categorise(row["narrative"])]
            bucket["n"] += 1
            bucket["total"] += row["amount"]
        print(f"\n=== {'MONEY OUT' if args.debits else 'ALL'} BY CATEGORY, {args.year} ===\n")
        print("  category                     count           total     share")
        grand = sum(b["total"] for b in buckets.values()) or 1.0
        for label, bucket in sorted(buckets.items(), key=lambda kv: -kv[1]["total"]):
            print(
                f"  {label:<28}{bucket['n']:6d}  {money(bucket['total']):>14}"
                f"  {bucket['total'] / grand * 100:7.1f}%"
            )
        print(f"  {'':<28}{len(rows):6d}  {money(grand):>14}   100.0%")

    if args.top:
        print(f"\n=== {args.top} LARGEST {'DEBITS' if args.debits else 'MOVEMENTS'} ===\n")
        for row in sorted(rows, key=lambda r: -r["amount"])[: args.top]:
            print(f"  {row['date']}  {row['direction']:<6} {money(row['amount']):>13}  {row['narrative'][:88]}")

    if args.csv:
        with open(args.csv, "w", newline="") as handle:
            writer = csv.DictWriter(
                handle, fieldnames=["month", "date", "direction", "amount", "balance",
                                    "category", "narrative"]
            )
            writer.writeheader()
            for row in all_rows:
                writer.writerow({**row, "category": categorise(row["narrative"])})
        print(f"\n  wrote {len(all_rows)} transactions to {args.csv}")


if __name__ == "__main__":
    main()
