"""Pick the friend most likely to get through right now.

Thompson sampling: each friend has a Beta(successes+1, failures+1) posterior per
4-hour time bucket. We sample each available friend's success rate and take the
argmax. This balances exploiting the friend who usually works against exploring
others, and it visibly learns over the weekend.
"""
from __future__ import annotations

from dataclasses import dataclass
from datetime import timedelta

import numpy as np
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..db import utcnow
from ..models import Friendship, FriendStat, User, UsageSession

AVAILABLE_WINDOW_MIN = 20


def hour_bucket(hour: int) -> int:
    return hour // 4  # 0..5


@dataclass
class FriendCandidate:
    friend_id: str
    name: str
    successes: int
    failures: int
    sampled_rate: float
    available: bool
    busy_scrolling: bool


def _friend_ids(db: Session, user_id: str) -> list[str]:
    return list(db.scalars(select(Friendship.friend_id).where(Friendship.user_id == user_id)))


def candidates(db: Session, user_id: str, rng: np.random.Generator | None = None) -> list[FriendCandidate]:
    rng = rng or np.random.default_rng()
    now = utcnow()
    bucket = hour_bucket(now.hour)
    out: list[FriendCandidate] = []
    for fid in _friend_ids(db, user_id):
        friend = db.get(User, fid)
        if friend is None:
            continue
        stat = db.get(FriendStat, (user_id, fid, bucket))
        s = stat.successes if stat else 0
        f = stat.failures if stat else 0
        sampled = float(rng.beta(s + 1, f + 1))
        available = friend.last_seen_at is not None and (now - friend.last_seen_at) <= timedelta(minutes=AVAILABLE_WINDOW_MIN)
        busy = db.scalar(
            select(UsageSession.id).where(
                UsageSession.user_id == fid,
                UsageSession.ended_at.is_(None),
                UsageSession.state == "problem",
            ).limit(1)
        ) is not None
        out.append(
            FriendCandidate(
                friend_id=fid, name=friend.name, successes=s, failures=f,
                sampled_rate=round(sampled, 3), available=available, busy_scrolling=busy,
            )
        )
    return out


def choose_friend(db: Session, user_id: str, rng: np.random.Generator | None = None) -> FriendCandidate | None:
    cands = [c for c in candidates(db, user_id, rng) if c.available and not c.busy_scrolling]
    if not cands:
        # fall back to any friend not currently doomscrolling, even if not recently active
        cands = [c for c in candidates(db, user_id, rng) if not c.busy_scrolling]
    if not cands:
        return None
    return max(cands, key=lambda c: c.sampled_rate)


def record_outcome(db: Session, user_id: str, friend_id: str, hour: int, success: bool) -> None:
    bucket = hour_bucket(hour)
    stat = db.get(FriendStat, (user_id, friend_id, bucket))
    if stat is None:
        # successes/failures carry a column default, which SQLAlchemy only applies at
        # INSERT — a freshly built row holds None, so `+= 1` below would blow up.
        stat = FriendStat(user_id=user_id, friend_id=friend_id, hour_bucket=bucket,
                          successes=0, failures=0)
        db.add(stat)
    if success:
        stat.successes += 1
    else:
        stat.failures += 1
