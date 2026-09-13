"""Simulated people for the leaderboard.

A leaderboard with two real names on it doesn't read as a leaderboard, so every
account is friends with a set of demo personas (the accounts on @doom.app) that
carry plausible, moving usage. Three rules keep them honest:

  1. They are always labelled "· demo" in the UI. Nobody should have to guess
     which rows are real people.
  2. They never receive an agent action and are never chosen as the friend to
     escalate to — they have no phone to buzz, so picking one would silently
     waste a real escalation.
  3. Their activity is generated deterministically from (user, minute), so it is
     idempotent: re-running fills only the gap since the last minute on record,
     and the same minute always produces the same value.
"""
from __future__ import annotations

import hashlib
from datetime import datetime, timedelta

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from .categories import ENTERTAINMENT, SOCIAL
from .db import utcnow
from .models import ActivityMinute, Credential, User

DEMO_EMAIL_SUFFIX = "@doom.app"
DEMO_TAG = " · demo"
BLOCK_MIN = 10        # people scroll in blocks, not in isolated minutes
BACKFILL_HOURS = 24   # the widest board window, so a fresh DB is never empty
UTC_OFFSET_H = -5     # Houston (CDT): shape the day around the demo's local clock

_cache: tuple[float, set[str]] | None = None
_CACHE_TTL_S = 60.0


def persona_ids(db: Session, *, fresh: bool = False) -> set[str]:
    global _cache
    import time

    now = time.monotonic()
    if not fresh and _cache is not None and now - _cache[0] < _CACHE_TTL_S:
        return _cache[1]
    # Two sources so neither path can miss one: the seeder's `simulated` flag and
    # the demo login domain.
    ids = set(db.scalars(select(User.id).where(User.simulated.is_(True))))
    ids |= set(db.scalars(select(Credential.user_id).where(
        Credential.email.like(f"%{DEMO_EMAIL_SUFFIX}"))))
    _cache = (now, ids)
    return ids


def is_persona(db: Session, user_id: str) -> bool:
    return user_id in persona_ids(db)


def _unit(*parts: object) -> float:
    """Stable pseudo-random float in [0,1) for these parts."""
    digest = hashlib.sha256("|".join(str(p) for p in parts).encode()).digest()
    return int.from_bytes(digest[:8], "big") / 2**64


def _intensity(user_id: str) -> float:
    """How heavy a user this persona is: 0.08 (light) .. 0.45 (heavy)."""
    return 0.08 + 0.37 * _unit(user_id, "intensity")


def _favourites(user_id: str) -> list[str]:
    """A stable 3-app habit, so each persona's top service stays recognisable."""
    pool = SOCIAL + ENTERTAINMENT
    ranked = sorted(pool, key=lambda s: _unit(user_id, "fav", s))
    return ranked[:3]


def _awake_weight(local_hour: int) -> float:
    """Rough daily rhythm: quiet overnight, a lunch bump, a heavy evening."""
    if 2 <= local_hour < 8:
        return 0.04
    if 8 <= local_hour < 12:
        return 0.45
    if 12 <= local_hour < 14:
        return 0.80
    if 14 <= local_hour < 18:
        return 0.55
    if 18 <= local_hour < 23:
        return 1.0
    return 0.65


def _block_start(minute: datetime) -> datetime:
    return minute.replace(minute=(minute.minute // BLOCK_MIN) * BLOCK_MIN, second=0, microsecond=0)


def minute_activity(user_id: str, minute: datetime) -> tuple[str, int] | None:
    """(service, queries) if this persona was scrolling in this minute, else None."""
    block = _block_start(minute)
    local_hour = (block.hour + UTC_OFFSET_H) % 24
    p = _intensity(user_id) * _awake_weight(local_hour)
    if _unit(user_id, "block", block.isoformat()) >= p:
        return None
    favs = _favourites(user_id)
    service = favs[int(_unit(user_id, "svc", block.isoformat()) * len(favs))]
    queries = 1 + int(_unit(user_id, "q", minute.isoformat()) * 5)
    return service, queries


def ensure_demo_activity(db: Session, now: datetime | None = None) -> int:
    """Fill each persona's activity forward to now. Returns minutes written.

    Fills only the gap since that persona's last recorded minute (capped at
    BACKFILL_HOURS), so the steady-state cost is about one minute per persona
    per tick.
    """
    now = (now or utcnow()).replace(second=0, microsecond=0)
    earliest = now - timedelta(hours=BACKFILL_HOURS)
    written = 0
    for uid in persona_ids(db):
        last_active: datetime | None = None
        last = db.scalar(select(func.max(ActivityMinute.minute)).where(ActivityMinute.user_id == uid))
        if isinstance(last, str):  # SQLite hands back strings for aggregates
            last = datetime.fromisoformat(last)
        start = earliest
        if last is not None and last >= earliest:
            start = last.replace(second=0, microsecond=0) + timedelta(minutes=1)
        m = start
        while m <= now:
            hit = minute_activity(uid, m)
            if hit is not None:
                service, queries = hit
                last_active = m
                if db.get(ActivityMinute, (uid, service, m)) is None:
                    db.add(ActivityMinute(user_id=uid, service=service, minute=m, queries=queries))
                    written += 1
            m += timedelta(minutes=1)
        # Keep "last seen" honest for the board: a persona is online exactly when
        # they were last scrolling.
        if last_active is not None:
            person = db.get(User, uid)
            if person is not None and (person.last_seen_at is None or person.last_seen_at < last_active):
                person.last_seen_at = last_active
    if written:
        db.flush()
    return written
