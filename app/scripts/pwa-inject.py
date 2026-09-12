#!/usr/bin/env python3
"""Inject iOS/Android 'add to home screen' meta into the exported SPA index.html.

Expo's `output: single` build ignores +html.tsx, so we add the standalone-app
tags here after `expo export`. Idempotent. Run: python scripts/pwa-inject.py
"""
import sys
from pathlib import Path

HTML = Path(__file__).resolve().parents[1] / "dist" / "index.html"
TAGS = """    <meta name="apple-mobile-web-app-capable" content="yes" />
    <meta name="mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
    <meta name="apple-mobile-web-app-title" content="Nudge" />
    <link rel="apple-touch-icon" href="/icon.png" />
"""

def main() -> int:
    if not HTML.exists():
        print(f"no {HTML}; run expo export first", file=sys.stderr)
        return 1
    html = HTML.read_text(encoding="utf-8")
    if "apple-mobile-web-app-capable" in html:
        print("pwa-inject: already present")
        return 0
    # make the app draw under the notch, and inject the app tags before </head>
    html = html.replace(
        'content="width=device-width, initial-scale=1, shrink-to-fit=no"',
        'content="width=device-width, initial-scale=1, shrink-to-fit=no, viewport-fit=cover"')
    html = html.replace("</head>", TAGS + "</head>", 1)
    HTML.write_text(html, encoding="utf-8")
    print("pwa-inject: added home-screen app tags")
    return 0

if __name__ == "__main__":
    raise SystemExit(main())
