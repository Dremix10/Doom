"""Ingest real iOS usage via the Shortcuts app — no Apple account, no profile.

Each phone sets up two Personal Automations per app:
  When <app> Is Opened  -> Run immediately -> Get Contents of URL  POST .../open
  When <app> Is Closed  -> Run immediately -> Get Contents of URL  POST .../close

"Is Opened"/"Is Closed" fire on real foreground switches, so open->close is the
exact time the app was on screen. We manage these sessions explicitly (the
activity-gap timer never closes them). Every friend does this on their own phone
with their own links, which is how the whole group's real usage flows in.
"""
from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session

from ..db import utcnow
from ..models import UsageSession, User
from ..services import DISTRACTING, label

# Friendly aliases a user might pick in Shortcuts -> our service id.
ALIASES = {
    "x": "twitter", "twitter": "twitter", "tweetie": "twitter",
    "ig": "instagram", "insta": "instagram", "instagram": "instagram",
    "yt": "youtube", "youtube": "youtube",
    "tiktok": "tiktok", "tik-tok": "tiktok",
    "snap": "snapchat", "snapchat": "snapchat",
    "fb": "facebook", "facebook": "facebook",
    "reddit": "reddit",
}

# Apps we suggest on the setup page (id -> display name).
SUGGESTED = ["tiktok", "instagram", "youtube", "reddit", "snapchat", "twitter"]


def normalize_service(app: str) -> str | None:
    key = app.strip().lower().replace(" ", "")
    if key in ALIASES:
        return ALIASES[key]
    if key in DISTRACTING:
        return key
    return None


def open_shortcut_session(db: Session, user: User, service: str) -> UsageSession:
    existing = db.scalar(select(UsageSession).where(
        UsageSession.user_id == user.id, UsageSession.service == service,
        UsageSession.ended_at.is_(None), UsageSession.source == "shortcut"))
    if existing:
        existing.last_active_at = utcnow()
        return existing
    now = utcnow()
    s = UsageSession(user_id=user.id, service=service, started_at=now,
                     last_active_at=now, source="shortcut", minutes=0.5, state="fine")
    db.add(s)
    db.flush()
    return s


def close_shortcut_session(db: Session, user: User, service: str) -> UsageSession | None:
    s = db.scalar(select(UsageSession).where(
        UsageSession.user_id == user.id, UsageSession.service == service,
        UsageSession.ended_at.is_(None), UsageSession.source == "shortcut"))
    if not s:
        return None
    now = utcnow()
    s.ended_at = now
    s.last_active_at = now
    s.minutes = max(0.2, (now - s.started_at).total_seconds() / 60.0)
    return s


SETUP_HTML = """<!doctype html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>{app_name} · Shortcuts setup</title>
<style>
body{{font-family:-apple-system,system-ui,sans-serif;margin:0;padding:22px;background:#0b0b0f;color:#f2f2f7;line-height:1.5}}
h1{{font-size:26px;margin:0 0 4px}} h2{{font-size:17px;color:#7c7bff;margin:26px 0 8px}}
p{{color:#c7c7cc}} ol{{color:#c7c7cc;padding-left:20px}} li{{margin:6px 0}}
.card{{background:#16161c;border:1px solid #2a2a34;border-radius:14px;padding:14px;margin:10px 0}}
.app{{font-weight:700;font-size:16px;margin-bottom:6px}}
code{{display:block;background:#000;color:#8fe3b0;padding:8px 10px;border-radius:8px;font-size:12px;word-break:break-all;margin:4px 0}}
.tag{{color:#6b6b78;font-size:12px}}
</style></head><body>
<h1>{app_name} — no-profile setup</h1>
<p>Hi {name}. This uses Apple <b>Shortcuts</b>, so it needs no profile and no developer account.
For each app you want watched, make two quick automations on <b>this</b> phone.</p>

<h2>Do this once per app</h2>
<ol>
<li>Open <b>Shortcuts</b> → <b>Automation</b> tab → <b>+</b> → <b>App</b>.</li>
<li>Choose the app (e.g. TikTok), tick <b>Is Opened</b>, tap <b>Run Immediately</b>, Next.</li>
<li>Add action <b>Get Contents of URL</b>. Paste that app's <b>open</b> URL below. Tap the arrow → Method <b>POST</b>.</li>
<li>Make a second automation the same way with <b>Is Closed</b> and the <b>close</b> URL.</li>
</ol>
<p class="tag">Tip: “Run Immediately” means it fires silently with no popup.</p>

<h2>Your links</h2>
{cards}
<p class="tag">These carry your login, so keep them to yourself. Base API: {api}</p>
</body></html>
"""


def setup_page(user: User, api_base: str, app_name: str) -> str:
    cards = []
    for sid in SUGGESTED:
        name = label(sid)
        open_url = f"{api_base}/s/{user.token}/{sid}/open"
        close_url = f"{api_base}/s/{user.token}/{sid}/close"
        cards.append(
            f'<div class="card"><div class="app">{name}</div>'
            f'<span class="tag">Is Opened →</span><code>{open_url}</code>'
            f'<span class="tag">Is Closed →</span><code>{close_url}</code></div>'
        )
    return SETUP_HTML.format(app_name=app_name, name=user.name, api=api_base, cards="\n".join(cards))
