"""Seed the database with a friend group and three weeks of realistic history.

This is step 1 of the build plan: it lets the agent, baselines and the app be
built and demoed before any phone is streaming real DNS. Run:

    python -m simulator.seed --reset

It prints each user's token and setup URL so you can log into the app as any of them.

Nudge has no access to real iOS screen time (Apple gates it behind a paid
developer account), so every number in the demo comes from here. Two things the
leaderboard depends on: each persona spans all three service categories, and the
current day is seeded up to *now* — otherwise the "Today" board is all zeros.
"""
from __future__ import annotations

import argparse
import random
from datetime import timedelta

import numpy as np

from app.categories import CATEGORIES
from app.config import settings
from app.db import db_session, init_db, utcnow
from app.models import (ActivityMinute, DecisionLog, Friendship, Group, GroupMember, Intervention,
                        Notification, UsageSession, User)
from app.sessions import truncate_minute

TEAM = ["Demetris", "Maria", "Andreas", "Sofia", "Elena", "Nikos", "Christina"]

# Two leagues with different line-ups, so switching group visibly changes the board.
# Demetris (the demo login) is in both.
GROUPS = {
    "Roommates": ["Demetris", "Maria", "Andreas", "Sofia"],
    "CS Study Group": ["Demetris", "Maria", "Elena", "Nikos", "Christina"],
}
CATS = ["social", "entertainment", "productivity"]
SERVICES_BY_CAT = {c: CATEGORIES[c]["services"] for c in CATS}
SERVICES = [s for c in CATS for s in SERVICES_BY_CAT[c]]

# Typical minutes per visit. Streaming and deep work run long; checking Slack doesn't.
BASE_LEN = {
    "tiktok": 9, "instagram": 7, "twitter": 6, "reddit": 8, "snapchat": 5, "facebook": 7,
    "youtube": 13, "netflix": 28, "twitch": 22, "spotify": 18, "disneyplus": 26,
    "github": 16, "notion": 14, "slack": 9, "gmail": 6, "googledocs": 18, "figma": 20,
}

# Per-person daily rhythm. `mix` decides how their day splits across categories, so
# each category produces a genuinely different ranking: Maria tops productivity,
# Andreas tops entertainment, Demetris loses social.
PERSONAS = {
    "Demetris": {"sessions_per_day": 11, "night_owl": True, "fav": "tiktok",
                 "mix": {"social": 0.55, "entertainment": 0.30, "productivity": 0.15}},
    "Maria": {"sessions_per_day": 9, "night_owl": False, "fav": "instagram",
              "mix": {"social": 0.32, "entertainment": 0.18, "productivity": 0.50}},
    "Andreas": {"sessions_per_day": 8, "night_owl": False, "fav": "youtube",
                "mix": {"social": 0.22, "entertainment": 0.48, "productivity": 0.30}},
    "Sofia": {"sessions_per_day": 10, "night_owl": True, "fav": "reddit",
              "mix": {"social": 0.45, "entertainment": 0.25, "productivity": 0.30}},
    "Elena": {"sessions_per_day": 7, "night_owl": False, "fav": "notion",
              "mix": {"social": 0.20, "entertainment": 0.22, "productivity": 0.58}},
    "Nikos": {"sessions_per_day": 12, "night_owl": True, "fav": "twitch",
              "mix": {"social": 0.30, "entertainment": 0.52, "productivity": 0.18}},
    "Christina": {"sessions_per_day": 8, "night_owl": False, "fav": "instagram",
                  "mix": {"social": 0.48, "entertainment": 0.22, "productivity": 0.30}},
}


def _reset(db) -> None:
    for model in (ActivityMinute, Intervention, DecisionLog, Notification, UsageSession,
                  GroupMember, Group, Friendship, User):
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
    return users


def _make_groups(db, users: dict[str, User]) -> dict[str, Group]:
    """Create the leagues, and make co-members friends so pull-outs work."""
    groups = {}
    for name, member_names in GROUPS.items():
        members = [users[n] for n in member_names if n in users]
        group = Group(name=name, created_by=members[0].id)
        db.add(group)
        db.flush()
        for m in members:
            db.add(GroupMember(group_id=group.id, user_id=m.id))
        for a in members:
            for b in members:
                if a.id != b.id and not db.get(Friendship, (a.id, b.id)):
                    db.add(Friendship(user_id=a.id, friend_id=b.id))
        groups[name] = group
    db.flush()
    return groups


def _pick_service(rng, p: dict) -> tuple[str, str]:
    cat = random.choices(CATS, weights=[p["mix"][c] for c in CATS])[0]
    pool = SERVICES_BY_CAT[cat]
    if p["fav"] in pool and rng.random() < 0.45:
        return cat, p["fav"]
    return cat, random.choice(pool)


def _hour_of_day(rng, p: dict, cat: str) -> int:
    """Work apps cluster in work hours; scrolling skews evening, later for night owls."""
    if cat == "productivity":
        return int(np.clip(rng.normal(13, 2.6), 8, 19))
    if p["night_owl"] and rng.random() < 0.4:
        return int(rng.integers(22, 26)) % 24
    return int(np.clip(rng.normal(15, 4), 7, 23))


def _session_length(rng, service: str, fav: str, blowout: bool) -> float:
    base = BASE_LEN.get(service, 10)
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
        # `0` is today, seeded only up to the current time.
        for d in range(days, -1, -1):
            day_start = truncate_minute(now - timedelta(days=d))
            day_start = day_start.replace(hour=0, minute=0)
            n_sessions = max(1, int(rng.poisson(p["sessions_per_day"])))
            for _ in range(n_sessions):
                cat, service = _pick_service(rng, p)
                hour = _hour_of_day(rng, p, cat)
                minute = int(rng.integers(0, 60))
                start = day_start.replace(hour=hour, minute=minute)
                if start >= now:
                    continue  # hasn't happened yet today
                blowout = rng.random() < 0.06
                length = _session_length(rng, service, p["fav"], blowout)
                end = min(start + timedelta(minutes=length), now)
                length = max(1.0, (end - start).total_seconds() / 60.0)
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
    # 21 days so a 7-day leaderboard window still has a full 14-day baseline behind it.
    ap.add_argument("--days", type=int, default=21)
    ap.add_argument("--seed", type=int, default=42)
    args = ap.parse_args()

    rng = np.random.default_rng(args.seed)
    random.seed(args.seed)
    init_db()
    with db_session() as db:
        if args.reset:
            _reset(db)
        users = _make_users(db)
        groups = _make_groups(db, users)
        minutes = _seed_history(db, users, args.days, rng)
        print(f"Seeded {len(users)} users, {len(groups)} groups, {args.days} days, "
              f"~{minutes/60:.0f} hours of history.")
        for name, g in groups.items():
            print(f"  group {name:16} join={g.join_code}  ({len(GROUPS[name])} members)")
        print(f"\nAPP_NAME={settings.APP_NAME}  API={settings.PUBLIC_API_URL}\n")
        for name, u in users.items():
            print(f"  {name:9} token={u.token}")
            print(f"            invite={u.invite_code}  client_id={u.client_id}")
            print(f"            setup={settings.PUBLIC_API_URL}/setup/{u.token}")


if __name__ == "__main__":
    main()
