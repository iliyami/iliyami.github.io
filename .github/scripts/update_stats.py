#!/usr/bin/env python3
"""Bake live MacSai stats (GitHub stars, total release downloads) into index.html.

Run nightly by .github/workflows/update-stats.yml. Every element marked with
data-stat="<key>" gets its text replaced with the freshly formatted value, so
the published page is plain static HTML: no client-side API calls, no rate
limits, no number popping in after load. Values are floored and suffixed with
"+" so they never overstate, and so the file only changes (and gets committed)
when a displayed number actually moves.
"""
import json
import os
import re
import sys
import urllib.request
from pathlib import Path

REPO = "iliyami/MacSai"
HTML = Path(__file__).resolve().parents[2] / "index.html"


def gh(path):
    req = urllib.request.Request(f"https://api.github.com/{path}")
    req.add_header("Accept", "application/vnd.github+json")
    req.add_header("User-Agent", "iliyami.github.io-stats")
    token = os.environ.get("GITHUB_TOKEN")
    if token:
        req.add_header("Authorization", f"Bearer {token}")
    with urllib.request.urlopen(req, timeout=30) as res:
        return json.load(res)


def total_downloads():
    total, page = 0, 1
    while True:
        releases = gh(f"repos/{REPO}/releases?per_page=100&page={page}")
        total += sum(a["download_count"] for r in releases for a in r["assets"])
        if len(releases) < 100:
            return total
        page += 1


def compact(n):
    """Floor to a short label: 2096 -> '2K+', 2150 -> '2.1K+', 126462 -> '126K+'."""
    if n < 1000:
        return f"{n}+"
    if n < 10_000:
        tenths = n // 100  # 2096 -> 20
        whole, frac = divmod(tenths, 10)
        return f"{whole}K+" if frac == 0 else f"{whole}.{frac}K+"
    if n < 1_000_000:
        return f"{n // 1000}K+"
    tenths = n // 100_000
    whole, frac = divmod(tenths, 10)
    return f"{whole}M+" if frac == 0 else f"{whole}.{frac}M+"


def main():
    stars = gh(f"repos/{REPO}")["stargazers_count"]
    downloads = total_downloads()
    # Sanity floor: a broken/empty API response must never wipe real numbers.
    if stars < 1000 or downloads < 50_000:
        sys.exit(f"implausible stats (stars={stars}, downloads={downloads}); not writing")

    values = {"macsai-stars": compact(stars), "macsai-downloads": compact(downloads)}
    html = HTML.read_text(encoding="utf-8")
    for key, label in values.items():
        pattern = re.compile(rf'(data-stat="{re.escape(key)}"[^>]*>)[^<]*(<)')
        html, count = pattern.subn(rf"\g<1>{label}\g<2>", html)
        if count == 0:
            sys.exit(f'no data-stat="{key}" element found in {HTML.name}')
    HTML.write_text(html, encoding="utf-8")
    print(f"stars={stars} ({values['macsai-stars']}), downloads={downloads} ({values['macsai-downloads']})")


if __name__ == "__main__":
    main()
