#!/usr/bin/env python3
"""
One-off sweep: point every print page's logo at the shared company-logo helper.

Each print page carried its own copy of

    const API_ROOT = (...).replace('/api/v1', '');
    const logoSrc = (v?: string) => (!v ? '' : ... : `${API_ROOT}${v}`);

which builds http://host/uploads/<file>. That path is a 404 — uploaded files sit
behind a Bearer token an <img> cannot send — so the real company logo never
appeared on any printed document. Replaced with `companyLogoUrl` from lib/api,
which points at the public company-logo route. Call sites are unchanged.

Run from the frontend directory:  python3 scripts/fix-print-logo.py
"""
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent / "src" / "app"

API_ROOT_LINE = re.compile(
    r"^const API_ROOT = \(process\.env\.NEXT_PUBLIC_API_URL \|\| 'http://localhost:3001/api/v1'\)"
    r"\.replace\('/api/v1', ''\);\n",
    re.M,
)

LOGO_LINE = re.compile(
    r"^const logoSrc = \(v\?: string\) => \(!v \? '' : "
    r"\(v\.startsWith\('http'\) \|\| v\.startsWith\('data:'\)\) \? v : "
    r"`\$\{API_ROOT\}\$\{v\}`\);\n",
    re.M,
)

REPLACEMENT = (
    "// Uploaded files sit behind a Bearer token an <img> cannot send, so the old\n"
    "// `${API_ROOT}${v}` form resolved to a 404 and the logo never printed.\n"
    "const logoSrc = companyLogoUrl;\n"
)

IMPORT_LINE = re.compile(r"^import \{ ([^}]*?) \} from '@/lib/api';$", re.M)


def patch(path: Path) -> str:
    text = path.read_text(encoding="utf-8")
    original = text

    if "companyLogoUrl" in text:
        return "already done"
    if not LOGO_LINE.search(text):
        return "no local logoSrc — skipped"

    text = LOGO_LINE.sub(REPLACEMENT, text, count=1)

    # The API_ROOT constant existed only to build that URL. Drop it if nothing
    # else refers to it, and leave it alone if anything does.
    if len(re.findall(r"\bAPI_ROOT\b", text)) == 1:
        text = API_ROOT_LINE.sub("", text, count=1)

    match = IMPORT_LINE.search(text)
    if not match:
        return "no '@/lib/api' import — SKIPPED, needs a look"
    names = [n.strip() for n in match.group(1).split(",") if n.strip()]
    if "companyLogoUrl" not in names:
        names.append("companyLogoUrl")
    text = IMPORT_LINE.sub(
        "import { " + ", ".join(names) + " } from '@/lib/api';", text, count=1
    )

    if text == original:
        return "unchanged"
    path.write_text(text, encoding="utf-8")
    return "patched"


def main() -> int:
    targets = sorted(
        p for p in ROOT.rglob("page.tsx") if "const logoSrc = (v?: string)" in p.read_text(encoding="utf-8")
    )
    if not targets:
        print("Nothing left to patch.")
        return 0
    problems = 0
    for p in targets:
        result = patch(p)
        if "SKIPPED" in result:
            problems += 1
        print(f"{result:>34}  {p.relative_to(ROOT.parent.parent)}")
    print(f"\n{len(targets)} file(s) examined, {problems} needing attention.")
    return 1 if problems else 0


if __name__ == "__main__":
    sys.exit(main())
