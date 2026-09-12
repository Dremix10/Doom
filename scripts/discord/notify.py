#!/usr/bin/env python3
"""Post a message to the team Discord channel via a webhook.

Usage:
  python3 scripts/discord/notify.py "message text"
  echo "message" | python3 scripts/discord/notify.py
  python3 scripts/discord/notify.py --file notes.md --as "Claude (planner)"
  python3 scripts/discord/notify.py --dry-run "preview the chunks without sending"

Webhook URL is read from $DISCORD_WEBHOOK_URL, else from DISCORD_WEBHOOK_URL=... in
the project's .env file. If neither is set the script prints a notice and exits 0,
so hooks never fail the session because Discord is not configured yet.
"""
from __future__ import annotations

import argparse
import json
import os
import sys
import time
import urllib.error
import urllib.request

PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
DISCORD_LIMIT = 2000
CHUNK = 1900  # leave room for a continuation marker


def load_dotenv_value(key: str) -> str | None:
    path = os.path.join(PROJECT_ROOT, ".env")
    try:
        with open(path, encoding="utf-8") as fh:
            for line in fh:
                line = line.strip()
                if not line or line.startswith("#") or "=" not in line:
                    continue
                k, v = line.split("=", 1)
                if k.strip() == key:
                    return v.strip().strip('"').strip("'")
    except FileNotFoundError:
        return None
    return None


def webhook_url() -> str | None:
    return os.environ.get("DISCORD_WEBHOOK_URL") or load_dotenv_value("DISCORD_WEBHOOK_URL")


def chunk(text: str, size: int = CHUNK) -> list[str]:
    """Split on newline boundaries when possible so markdown blocks stay readable."""
    text = text.strip()
    if not text:
        return []
    parts: list[str] = []
    while len(text) > size:
        cut = text.rfind("\n", 0, size)
        if cut < size // 2:
            cut = text.rfind(" ", 0, size)
        if cut < size // 2:
            cut = size
        parts.append(text[:cut].rstrip())
        text = text[cut:].lstrip()
    if text:
        parts.append(text)
    return parts


def post(message: str, username: str | None = None, dry_run: bool = False) -> bool:
    url = webhook_url()
    parts = chunk(message)
    if not parts:
        return True
    if dry_run:
        for i, p in enumerate(parts, 1):
            print(f"--- chunk {i}/{len(parts)} ({len(p)} chars) as {username or 'default'} ---")
            print(p)
        return True
    if not url:
        print("discord: DISCORD_WEBHOOK_URL not set (env or .env); message not sent", file=sys.stderr)
        return False
    ok = True
    for i, p in enumerate(parts):
        if len(parts) > 1:
            p = f"{p}\n*({i + 1}/{len(parts)})*"
        payload = {"content": p[:DISCORD_LIMIT], "allowed_mentions": {"parse": []}}
        if username:
            payload["username"] = username[:80]
        req = urllib.request.Request(
            url,
            data=json.dumps(payload).encode("utf-8"),
            headers={"Content-Type": "application/json", "User-Agent": "hackrice16-notify/1.0"},
            method="POST",
        )
        for attempt in range(3):
            try:
                with urllib.request.urlopen(req, timeout=15) as resp:
                    resp.read()
                break
            except urllib.error.HTTPError as e:
                if e.code == 429 and attempt < 2:
                    try:
                        wait = float(json.loads(e.read().decode()).get("retry_after", 1))
                    except Exception:
                        wait = 1.0
                    time.sleep(wait + 0.2)
                    continue
                print(f"discord: HTTP {e.code} {e.reason}", file=sys.stderr)
                ok = False
                break
            except Exception as e:  # network errors must never break the session
                print(f"discord: {e}", file=sys.stderr)
                ok = False
                break
        if i < len(parts) - 1:
            time.sleep(0.5)  # webhook rate limit is 5 posts / 2 s
    return ok


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("message", nargs="?", help="message text (or pipe via stdin)")
    ap.add_argument("--file", "-f", help="read the message from a file")
    ap.add_argument("--as", dest="username", default="Claude", help="display name for the post")
    ap.add_argument("--dry-run", action="store_true", help="print chunks instead of sending")
    args = ap.parse_args()

    if args.file:
        with open(args.file, encoding="utf-8") as fh:
            text = fh.read()
    elif args.message is not None:
        text = args.message
    else:
        text = sys.stdin.read()

    return 0 if post(text, username=args.username, dry_run=args.dry_run) else 1


if __name__ == "__main__":
    sys.exit(main())
