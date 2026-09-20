#!/usr/bin/env python3
"""
scan-adcb.py — read-only sweep of the ADCB statement PDFs.

Extracts every statement under the given roots, de-duplicates them by the
transactions they contain, and answers targeted questions against the text:
who paid what, and when.

Usage:
    python3 scan-adcb.py                      # summary of every statement found
    python3 scan-adcb.py --grep 25,200        # every line matching a term
    python3 scan-adcb.py --year 2025 --credits
"""

import argparse
import hashlib
import os
import re
import sys

try:
    from pypdf import PdfReader
except ImportError:  # pragma: no cover
    sys.exit("pypdf is not installed: python3 -m pip install --user pypdf")

ROOTS = [
    os.path.expanduser("~/Downloads/ADCB 2025"),
    os.path.expanduser("~/Documents"),
    os.path.expanduser("~/Desktop"),
]

DATE = re.compile(r"\b(\d{2})/(\d{2})/(\d{4})\b")
AMOUNT = re.compile(r"\b\d{1,3}(?:,\d{3})*\.\d{2}\b")


def find_statements():
    """Every ADCB statement PDF under the roots, newest path last."""
    found = []
    seen = set()
    for root in ROOTS:
        if not os.path.isdir(root):
            continue
        for dirpath, _dirnames, filenames in os.walk(root):
            for name in filenames:
                low = name.lower()
                if "adcbstmt" not in low and "e-statement" not in low:
                    continue
                if not low.endswith(".pdf"):
                    continue
                path = os.path.join(dirpath, name)
                # De-duplicate on the bytes, not the size: two different months
                # can share a size, and dropping one silently loses a month.
                with open(path, "rb") as handle:
                    key = hashlib.sha256(handle.read()).hexdigest()
                if key in seen:
                    continue
                seen.add(key)
                found.append(path)
    return sorted(found)


def read_text(path):
    """Full text of a statement, or None with a reason if it will not open."""
    try:
        reader = PdfReader(path)
        if reader.is_encrypted:
            try:
                if reader.decrypt("") == 0:
                    return None, "password protected"
            except Exception:
                return None, "password protected"
        pages = []
        for page in reader.pages:
            pages.append(page.extract_text() or "")
        return "\n".join(pages), None
    except Exception as error:  # noqa: BLE001
        return None, f"unreadable: {error}"


def period_of(text):
    """The date span the statement covers, read off its own transaction dates."""
    dates = DATE.findall(text)
    if not dates:
        return None, None
    stamps = sorted(f"{y}-{m}-{d}" for d, m, y in dates)
    return stamps[0], stamps[-1]


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--grep", action="append", default=[],
                        help="print every line containing this term")
    parser.add_argument("--year", default=None, help="restrict to one year")
    parser.add_argument("--context", type=int, default=0,
                        help="lines of context around each match")
    args = parser.parse_args()

    statements = find_statements()
    if not statements:
        sys.exit("no ADCB statement PDFs found")

    print(f"=== {len(statements)} STATEMENT FILES ===\n")

    corpus = []
    for path in statements:
        text, problem = read_text(path)
        label = os.path.basename(path)
        if text is None:
            print(f"  {label:<44} {problem}")
            continue
        first, last = period_of(text)
        span = f"{first} .. {last}" if first else "no dates found"
        if args.year and first and not (first.startswith(args.year)
                                        or (last or "").startswith(args.year)):
            continue
        print(f"  {label:<44} {span}")
        corpus.append((label, text))

    if not args.grep:
        return

    for term in args.grep:
        print(f"\n=== LINES MATCHING {term!r} ===\n")
        hits = 0
        for label, text in corpus:
            lines = text.splitlines()
            for index, line in enumerate(lines):
                if term.lower() not in line.lower():
                    continue
                hits += 1
                low = max(0, index - args.context)
                high = min(len(lines), index + args.context + 1)
                print(f"  [{label}]")
                for offset in range(low, high):
                    marker = ">" if offset == index else " "
                    print(f"   {marker} {lines[offset].strip()}")
                print()
        if hits == 0:
            print("  no match anywhere")
        else:
            print(f"  {hits} match(es)")


if __name__ == "__main__":
    main()
