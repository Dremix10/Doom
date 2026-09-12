"""Deliver friend-written messages at the moment they're most likely to land.

A friend writes the message now; the agent decides when it goes. Two triggers,
whichever comes first:

  1. the recipient is doomscrolling right now — the phone is literally in their
     hand, which is the best moment a message about putting it down can arrive;
  2. the recipient's worst stretch of the day comes round, taken from the same
     4-hour buckets `friends.py` already samples over.

Trigger 1 needs no learning at all, which is deliberate: the smarter version of
this is a refinement, not a prerequisite. Everything delivered here is logged as
an Intervention with kind "scheduled", so `evaluate_outcomes` scores it and
`record_outcome` feeds the per-friend, per-bucket posteriors — meaning the
feature generates exactly the training signal a future timing model would need.
"""
from __future__ import annotations

import logging
from datetime import timedelta

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..db import utcnow
from ..models import ActivityMinute, Intervention, QueuedMessage, UsageSession, User
from .friends import hour_bucket
from .policy import NUDGE_COOLDOWN_MIN, _scaled_minutes

log = logging.getLogger(__name__)

EXPIRY_DAYS = 7
HISTORY_DAYS = 14


def expires_after(now=None):
    return (now or utcnow()) + timedelta(days=EXPIRY_DAYS)


def worst_bucket(db: Session, user_id: str) -> int | None:
    """Which 4-hour stretch this person burns the most time in, over two weeks."""
    since = utcnow() - timedelta(days=HISTORY_DAYS)
    minutes = db.scalars(
        select(ActivityMinute.minute).where(
            ActivityMinute.user_id == user_id, ActivityMinute.minute >= since
        )
    ).all()
    if not minutes:
        return None
    counts: dict[int, int] = {}
    for m in minutes:
        b = hour_bucket(m.hour)
        counts[b] = counts.get(b, 0) + 1
    return max(counts, key=counts.get)


def _open_session(db: Session, user_id: str) -> UsageSession | None:
    return db.scalar(
        select(UsageSession)
        .where(UsageSession.user_id == user_id, UsageSession.ended_at.is_(None))
        .order_by(UsageSession.started_at.desc())
        .limit(1)
    )


def _due(db: Session, msg: QueuedMessage, session: UsageSession | None, now) -> str | None:
    """Return why this message should go now, or None to keep waiting."""
    if session is not None and session.state == "problem":
        return "they were doomscrolling"
    bucket = worst_bucket(db, msg.to_user_id)
    if bucket is not None and hour_bucket(now.hour) == bucket:
        # Only once we've crossed *into* the bucket since it was written — otherwise
        # writing during someone's peak hour would send it immediately, which is
        # just a pull-out with extra steps.
        bucket_start = now.replace(hour=(now.hour // 4) * 4, minute=0, second=0, microsecond=0)
        if msg.created_at < bucket_start:
            return "it was their usual peak hour"
    return None


def _recently_bothered(db: Session, user_id: str, now) -> bool:
    """The 'never nag' promise applies to these too: four friends queuing messages
    must not become four notifications the moment someone opens TikTok."""
    last = db.scalar(
        select(func.max(Intervention.created_at)).where(Intervention.user_id == user_id)
    )
    if last is None:
        return False
    return (now - last).total_seconds() / 60.0 < _scaled_minutes(NUDGE_COOLDOWN_MIN)


def deliver_due(db: Session) -> int:
    """Called every agent tick. Returns how many messages went out."""
    from ..delivery import notify as notify_mod

    now = utcnow()
    sent = 0
    pending = db.scalars(
        select(QueuedMessage).where(QueuedMessage.status == "pending").order_by(QueuedMessage.created_at)
    ).all()

    handled: set[str] = set()  # at most one queued message per person per tick
    for msg in pending:
        if msg.expires_at <= now:
            msg.status = "expired"
            continue
        if msg.to_user_id in handled or _recently_bothered(db, msg.to_user_id, now):
            continue

        session = _open_session(db, msg.to_user_id)
        reason = _due(db, msg, session, now)
        if not reason:
            continue

        sender = db.get(User, msg.from_user_id)
        recipient = db.get(User, msg.to_user_id)
        if sender is None or recipient is None:
            msg.status = "expired"
            continue

        iv = Intervention(
            user_id=recipient.id,
            session_id=session.id if session else None,
            kind="scheduled",
            actor="friend",
            friend_id=sender.id,
            message=msg.text,
            justification=f"{sender.name} left this for the right moment; sent because {reason}.",
        )
        db.add(iv)
        notify_mod.send(
            db, recipient.id, "scheduled", f"{sender.name} left you a message",
            msg.text, payload={"from": sender.name, "from_id": sender.id, "reason": reason}, sms=True,
        )
        msg.status, msg.delivered_at, msg.reason = "sent", now, reason
        handled.add(msg.to_user_id)
        sent += 1
        log.info("delivered queued message from %s to %s (%s)", sender.name, recipient.name, reason)

    if sent:
        db.flush()
    return sent
