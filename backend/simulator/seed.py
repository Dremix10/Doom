"""Seed the database with a friend group and 14 days of realistic history.

This is step 1 of the build plan: it lets the agent, baselines and the app be
built and demoed before any phone is streaming real DNS. Run:

    python -m simulator.seed --reset

It prints each user's token and setup URL so you can log into the app as any of them.
"""
from __future__ import annotations

import argparse
import random
from datetime import timedelta

import numpy as np

from app.config import settings
from app.db import db_session, init_db, utcnow
from app.models import (ActivityMinute, DecisionLog, Friendship, Intervention, Notification,
                        UsageSession, User)
from app.sessions import truncate_minute

TEAM = ["Demetris", "Maria", "Andreas", "Sofia"]
SERVICES = ["tiktok", "instagram", "youtube", "reddit", "twitter"]

# Per-person daily rhythm: sessions per day and a personal "typical length" per service.
PERSONAS = {
    "Demetris": {"sessions_per_day": 9, "night_owl": True, "fav": "tiktok"},
    "Maria": {"sessions_per_day": 6, "night_owl": False, "fav": "instagram"},
    "Andreas": {"sessions_per_day": 5, "night_owl": False, "fav": "youtube"},
    "Sofia": {"sessions_per_day": 8, "night_owl": True, "fav": "reddit"},
}


def _reset(db) -> None:
    for model in (ActivityMinute, Intervention, DecisionLog, Notification, UsageSession, Friendship, User):
        db.query(model).delete()
    db.flush()


def _make_users(db) -> dict[str, User]:
    users = {}
    for name in TEAM:
        u = User(name=name, timezone="America/Chicago", persona_verified=True,
                 phone=None, last_seen_at=utcnow())
        db.add(u)
        users[name] = u
    db.flush()
    # everyone friends with everyone
    for a in users.values():
        for b in users.values():
            if a.id != b.id:
                db.add(Friendship(user_id=a.id, friend_id=b.id))
    db.flush()
    return users


def _session_length(rng, service: str, fav: str, blowout: bool) -> float:
    base = {"tiktok": 9, "instagram": 7, "youtube": 13, "reddit": 8, "twitter": 6}[service]
    if service == fav:
        base *= 1.4
    length = rng.lognormal(mean=np.log(base), sigma=0.5)
    if blowout:
        length *= rng.uniform(2.5, 4.0)
    return float(max(2.0, min(length, 180.0)))


def _seed_history(db, users: dict[str, User], days: int, rng) -> int:
    now = utcnow()
    total_minutes = 0
    for name, user in users.items():
        p = PERSONAS[name]
        # Overlapping same-service sessions share minutes; accumulate then insert once.
        minute_queries: dict[tuple[str, object], int] = {}
        for d in range(days, 0, -1):
            day_start = truncate_minute(now - timedelta(days=d))
            day_start = day_start.replace(hour=0, minute=0)
            n_sessions = max(1, int(rng.poisson(p["sessions_per_day"])))
            for _ in range(n_sessions):
                service = p["fav"] if rng.random() < 0.4 else random.choice(SERVICES)
                # hour of day: night owls skew late
                if p["night_owl"] and rng.random() < 0.4:
                    hour = int(rng.integers(22, 26)) % 24
                else:
                    hour = int(np.clip(rng.normal(15, 4), 7, 23))
                minute = int(rng.integers(0, 60))
                start = day_start.replace(hour=hour, minute=minute)
                blowout = rng.random() < 0.06
                length = _session_length(rng, service, p["fav"], blowout)
                end = start + timedelta(minutes=length)
                sess = UsageSession(user_id=user.id, service=service, started_at=start,
                                    last_active_at=end - timedelta(minutes=1), ended_at=end,
                                    minutes=length, state="fine")
                db.add(sess)
                # activity minutes so the sensor-derived path has data too; dedupe overlaps
                m = truncate_minute(start)
                while m < end:
                    key = (service, m)
                    minute_queries[key] = minute_queries.get(key, 0) + int(rng.integers(1, 6))
                    m += timedelta(minutes=1)
                total_minutes += int(length)
        for (service, m), q in minute_queries.items():
            db.add(ActivityMinute(user_id=user.id, service=service, minute=m, queries=q))
        db.flush()
    return total_minutes


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--reset", action="store_true", help="wipe existing data first")
    ap.add_argument("--days", type=int, default=14)
    ap.add_argument("--seed", type=int, default=42)
    args = ap.parse_args()

    rng = np.random.default_rng(args.seed)
    random.seed(args.seed)
    init_db()
    with db_session() as db:
        if args.reset:
            _reset(db)
        users = _make_users(db)
        minutes = _seed_history(db, users, args.days, rng)
        print(f"Seeded {len(users)} users, {args.days} days, ~{minutes/60:.0f} hours of history.")
        print(f"\nAPP_NAME={settings.APP_NAME}  API={settings.PUBLIC_API_URL}\n")
        for name, u in users.items():
            print(f"  {name:9} token={u.token}")
            print(f"            invite={u.invite_code}  client_id={u.client_id}")
            print(f"            setup={settings.PUBLIC_API_URL}/setup/{u.token}")


if __name__ == "__main__":
    main()
