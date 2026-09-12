"""Turn minute-level activity into sessions.

A session is a run of active minutes for one user and one service where no gap
exceeds SESSION_GAP_MIN. Sessions are the unit the agent reasons about.
"""
from __future__ import annotations

from datetime import datetime, timedelta

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from .config import settings
from .db import utcnow
from .models import ActivityMinute, UsageSession


def truncate_minute(ts: datetime) -> datetime:
    return ts.replace(second=0, microsecond=0)


def record_activity(db: Session, user_id: str, service: str, minute: datetime, queries: int = 1) -> None:
    minute = truncate_minute(minute)
    row = db.get(ActivityMinute, (user_id, service, minute))
    if row is None:
        db.add(ActivityMinute(user_id=user_id, service=service, minute=minute, queries=queries))
        # flush so a later call in the same session sees this row (autoflush is off)
        db.flush()
    else:
        row.queries += queries


def open_sessions(db: Session, user_id: str | None = None) -> list[UsageSession]:
    stmt = select(UsageSession).where(UsageSession.ended_at.is_(None))
    if user_id:
        stmt = stmt.where(UsageSession.user_id == user_id)
    return list(db.scalars(stmt))


def _minutes(started: datetime, last: datetime) -> float:
    return max(1.0, (last - started).total_seconds() / 60.0 + 1.0)


def refresh_sessions(db: Session, now: datetime | None = None) -> None:
    """Extend, open and close sessions from recent activity. Cheap enough to run every poll."""
    now = now or utcnow()
    gap = timedelta(minutes=settings.SESSION_GAP_MIN)

    # Close sessions that went quiet.
    for s in open_sessions(db):
        if now - s.last_active_at > gap:
            s.ended_at = s.last_active_at + timedelta(minutes=1)
            s.minutes = _minutes(s.started_at, s.last_active_at)

    # Recent activity grouped by user and service.
    window_start = truncate_minute(now - gap - timedelta(minutes=1))
    stmt = (
        select(
            ActivityMinute.user_id,
            ActivityMinute.service,
            func.min(ActivityMinute.minute),
            func.max(ActivityMinute.minute),
        )
        .where(ActivityMinute.minute >= window_start)
        .group_by(ActivityMinute.user_id, ActivityMinute.service)
    )
    open_by_key = {(s.user_id, s.service): s for s in open_sessions(db)}
    for user_id, service, first_minute, last_minute in db.execute(stmt):
        if isinstance(first_minute, str):  # SQLite returns strings for aggregates
            first_minute = datetime.fromisoformat(first_minute)
            last_minute = datetime.fromisoformat(last_minute)
        key = (user_id, service)
        s = open_by_key.get(key)
        if s is None:
            s = UsageSession(user_id=user_id, service=service, started_at=first_minute, last_active_at=last_minute)
            db.add(s)
            open_by_key[key] = s
        elif last_minute > s.last_active_at:
            s.last_active_at = last_minute
        s.minutes = _minutes(s.started_at, s.last_active_at)
    db.flush()


def effective_minutes(s: UsageSession, now: datetime | None = None) -> float:
    """Minutes as the agent sees them: wall clock since the session started, scaled in demo mode."""
    now = now or utcnow()
    end = s.ended_at or now
    raw = max(0.0, (end - s.started_at).total_seconds() / 60.0) + (0.0 if s.ended_at else 0.5)
    if settings.DEMO_MODE:
        raw *= settings.DEMO_TIME_SCALE
    return round(raw, 2)
