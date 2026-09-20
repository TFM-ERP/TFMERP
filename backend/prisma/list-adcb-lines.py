#!/usr/bin/env python3
"""
list-adcb-lines.py — read-only. Prints the transaction lines of one ADCB
statement in the order they appear, so a month can be read end to end.

    python3 list-adcb-lines.py "111 ADCBStmt_152456985_52910[54].pdf"
    python3 list-adcb-lines.py --find 2025-01
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


def statements():
    seen = set()
    for root in ROOTS:
        if not os.path.isdir(root):
            continue
        for dirpath, _dirs, names in os.walk(root):
            for name in names:
                low = name.lower()
                if ("adcbstmt" not in low and "e-statement" not in low) or not low.endswith(".pdf"):
                    continue
                path = os.path.join(dirpath, name)
                with open(path, "rb") as handle:
                    key = hashlib.sha256(handle.read()).hexdigest()
                if key not in seen:
                    seen.add(key)
                    yield path


def text_of(path):
    try:
        reader = PdfReader(path)
        if reader.is_encrypted and reader.decrypt("") == 0:
            return None
        return "\n".join((page.extract_text() or "") for page in reader.pages)
    except Exception:  # noqa: BLE001
        return None


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("name", nargs="?", help="statement filename or a fragment of it")
    parser.add_argument("--find", help="pick the statement covering this YYYY-MM")
    args = parser.parse_args()

    chosen = None
    for path in statements():
        base = os.path.basename(path)
        if args.name and args.name.lower() in base.lower():
            chosen = (base, text_of(path))
            break
        if args.find:
            body = text_of(path)
            if not body:
                continue
            stamps = sorted(f"{y}-{m}" for _d, m, y in
                            [(d, m, y) for d, m, y in DATE.findall(body)])
            if stamps and args.find in stamps:
                chosen = (base, body)
                break

    if not chosen or not chosen[1]:
        sys.exit("no readable statement matched")

    label, body = chosen
    print(f"=== {label} ===\n")
    for line in body.splitlines():
        stripped = line.strip()
        if stripped:
            print(stripped)


if __name__ == "__main__":
    main()
