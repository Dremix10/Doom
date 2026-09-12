"""Drive a live doomscroll for the demo without a phone.

Injects activity-minute rows for a user in real time so the running agent sees an
open session grow and reacts (quiet -> nudge -> escalate -> a friend pulls out).
Use this to rehearse the 2-minute demo, or as a fallback if the DNS sensor flakes
on stage. Run against the SAME database the API uses:

    python -m simulator.live --user Demetris --service tiktok --minutes 6

With DEMO_MODE=1 the agent scales time, so ~1 real minute reads as ~20 baseline
minutes and the escalation happens fast enough for a live demo.
"""
from __future__ import annotations

import argparse
import time
from datetime import timedelta

from sqlalchemy import select

from app.config import settings
from app.db import db_session, init_db, utcnow
from app.models import User
from app.sessions import record_activity, refresh_sessions


def find_user(db, name_or_id: str) -> User | None:
    u = db.scalar(select(User).where(User.name == name_or_id))
    return u or db.get(User, name_or_id)


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--user", required=True, help="name or id of the scroller")
    ap.add_argument("--service", default="tiktok")
    ap.add_argument("--minutes", type=float, default=6.0, help="how long to scroll, wall-clock")
    ap.add_argument("--step", type=float, default=5.0, help="seconds between activity pings")
    args = ap.parse_args()

    init_db()
    with db_session() as db:
        user = find_user(db, args.user)
        if not user:
            raise SystemExit(f"no user {args.user!r}; run simulator.seed first")
        uid, uname = user.id, user.name
    print(f"[live] {uname} scrolling {args.service} for {args.minutes} min "
          f"(demo_mode={settings.DEMO_MODE}). Watch the agent loop / app react.")
    end = time.time() + args.minutes * 60
    while time.time() < end:
        now = utcnow()
        with db_session() as db:
            # backfill the last minute densely so it reads as continuous activity
            for k in range(2):
                record_activity(db, uid, args.service, now - timedelta(seconds=30 * k), queries=4)
            refresh_sessions(db, now)
        print(f"  {now:%H:%M:%S} ping {args.service}", flush=True)
        time.sleep(args.step)
    print("[live] done scrolling.")


if __name__ == "__main__":
    main()
