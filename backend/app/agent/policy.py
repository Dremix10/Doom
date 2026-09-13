"""The orchestrator. Turns one open session into at most one action, applying the
hard guardrails that sit OUTSIDE the LLM, then carrying the action out.

Guardrails (non-negotiable, enforced in code):
  - at most one agent nudge per NUDGE_COOLDOWN_MIN minutes per session
  - never escalate before at least one nudge on this session
  - at most MAX_ESCALATIONS_PER_DAY escalations per user per day
  - never escalate to a friend who is themselves in a problem session
  - interrupts last INTERRUPT_MIN minutes, then auto-clear
"""
from __future__ import annotations

import logging
from datetime import timedelta

import numpy as np
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..config import settings
from ..db import utcnow
from ..models import DecisionLog, Intervention, UsageSession, User
from ..categories import is_policed
from ..services import label
from ..delivery import notify, voice
from . import friends as friends_mod
from . import gemini
from . import claude_agent
from .features import build_features, problem_score

log = logging.getLogger(__name__)

NUDGE_COOLDOWN_MIN = 20        # no second plain nudge within this window
ESCALATE_AFTER_MIN = 3         # if still a problem this long after a nudge, the nudge "failed"
MAX_ESCALATIONS_PER_DAY = 2
INTERRUPT_MIN = 10


def _scaled_minutes(minutes: float) -> float:
    """Wall-clock threshold, compressed in demo mode so the whole arc fits a 2-min demo."""
    if settings.DEMO_MODE and settings.DEMO_TIME_SCALE > 1:
        return minutes / settings.DEMO_TIME_SCALE
    return minutes


def _escalations_today(db: Session, user_id: str) -> int:
    start = utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
    return int(db.scalar(select(func.count(Intervention.id)).where(
        Intervention.user_id == user_id, Intervention.kind == "escalate", Intervention.created_at >= start)) or 0)


def _nudges_this_session(db: Session, session_id: str) -> int:
    return int(db.scalar(select(func.count(Intervention.id)).where(
        Intervention.session_id == session_id, Intervention.kind.in_(("nudge", "escalate")))) or 0)


def _log(db: Session, user_id: str, session_id: str, action: str, justification: str, features: dict, source: str) -> None:
    # Collapse runs of "stayed quiet": if the last logged decision for this user was
    # also quiet, refresh it in place instead of flooding the timeline every tick.
    if action == "quiet":
        last = db.scalar(select(DecisionLog).where(DecisionLog.user_id == user_id)
                         .order_by(DecisionLog.created_at.desc()).limit(1))
        if last is not None and last.action == "quiet":
            last.created_at = utcnow()
            last.justification = justification
            last.session_id = session_id
            last.features = __import__("json").dumps(features, default=str)
            return
    db.add(DecisionLog(user_id=user_id, session_id=session_id, action=action,
                       justification=justification, features=__import__("json").dumps(features, default=str), source=source))


def apply_interrupt(db: Session, user: "User", service: str) -> None:
    """Block one service for this phone for INTERRUPT_MIN minutes via AdGuard."""
    if not settings.sensor_enabled:
        return
    try:
        from ..sensor.adguard import adguard
        adguard().set_blocked_services(user.client_id, user.name, [service])
    except Exception as exc:
        log.warning("interrupt block failed: %s", exc)


def clear_expired_interrupts(db: Session) -> None:
    now = utcnow()
    stmt = select(Intervention).where(Intervention.kind == "interrupt", Intervention.outcome == "pending",
                                      Intervention.expires_at.is_not(None), Intervention.expires_at <= now)
    for iv in db.scalars(stmt):
        user = db.get(User, iv.user_id)
        iv.outcome = "success"  # cleared cleanly
        iv.evaluated_at = now
        if user and settings.sensor_enabled:
            try:
                from ..sensor.adguard import adguard
                adguard().set_blocked_services(user.client_id, user.name, [])
            except Exception as exc:
                log.warning("interrupt clear failed: %s", exc)


def evaluate_outcomes(db: Session) -> None:
    """Mark interventions success/fail: success if the session ended within 5 min of the nudge."""
    now = utcnow()
    stmt = select(Intervention).where(Intervention.outcome == "pending", Intervention.kind.in_(("nudge", "escalate", "pullout", "scheduled")))
    for iv in db.scalars(stmt):
        session = db.get(UsageSession, iv.session_id) if iv.session_id else None
        deadline = iv.created_at + timedelta(minutes=5)
        if session and session.ended_at and session.ended_at <= deadline:
            iv.outcome, iv.evaluated_at = "success", now
        elif now > deadline:
            iv.outcome, iv.evaluated_at = "fail", now
        else:
            continue
        if iv.kind in ("escalate", "pullout", "scheduled") and iv.friend_id:
            friends_mod.record_outcome(db, iv.user_id, iv.friend_id, iv.created_at.hour, iv.outcome == "success")


def act_on_session(db: Session, session: UsageSession) -> str:
    """Evaluate one open session and take at most one action. Returns the action taken."""
    user = db.get(User, session.user_id)
    if user is None:
        return "quiet"
    # Working long isn't doomscrolling. Don't score it, don't act on it.
    if not is_policed(session.service):
        session.state = "fine"
        return "quiet"
    feats, baseline = build_features(db, session)
    score, state = problem_score(feats, baseline)
    session.problem_score, session.state = score, state

    now = utcnow()
    last_nudge = db.scalar(select(func.max(Intervention.created_at)).where(
        Intervention.session_id == session.id, Intervention.kind == "nudge"))
    had_nudge = last_nudge is not None
    escalated_this_session = db.scalar(select(func.count(Intervention.id)).where(
        Intervention.session_id == session.id, Intervention.kind == "escalate")) or 0
    mins_since_nudge = (now - last_nudge).total_seconds() / 60.0 if last_nudge else None

    # A nudge is judged "failed" if the session is still a problem this long after it.
    nudge_failed = (
        had_nudge and mins_since_nudge is not None and mins_since_nudge >= _scaled_minutes(ESCALATE_AFTER_MIN)
    )
    can_escalate = (
        state == "problem" and nudge_failed and not escalated_this_session
        and _escalations_today(db, session.user_id) < MAX_ESCALATIONS_PER_DAY
    )
    # Nudge cooldown blocks only *repeat nudges*, never escalation.
    nudge_in_cooldown = (
        had_nudge and mins_since_nudge is not None and mins_since_nudge < _scaled_minutes(NUDGE_COOLDOWN_MIN)
    )

    if state == "fine":
        _log(db, session.user_id, session.id, "quiet", "Within your usual range.", feats.to_dict(), "guardrail")
        return "quiet"
    if not can_escalate and (had_nudge and nudge_in_cooldown):
        # already nudged, not yet time to escalate: hold.
        _log(db, session.user_id, session.id, "quiet",
             "Recently checked in; giving it a moment before doing more.", feats.to_dict(), "guardrail")
        return "quiet"

    friend = friends_mod.choose_friend(db, session.user_id) if can_escalate else None
    # It's past time to escalate but no friend is free to step in: HOLD. Falling back
    # to another nudge here would bypass the nudge cooldown and spam the user (and it
    # hits everyone with an open problem session and no available friend).
    if can_escalate and friend is None:
        _log(db, session.user_id, session.id, "quiet",
             "Past a nudge, but no friend is free to step in — holding.", feats.to_dict(), "guardrail")
        return "quiet"

    _llm = claude_agent if settings.ANTHROPIC_API_KEY else gemini
    can_escalate_now = can_escalate and friend is not None
    decision, source = _llm.decide(feats, state, allow_escalate=can_escalate_now, friend_hint=friend.name if friend else None)
    action = decision.get("action", "quiet")
    if action == "escalate" and not can_escalate_now:
        action = "nudge"
    # Belt-and-suspenders: never send a plain nudge inside the cooldown window,
    # whatever the model returns.
    if action == "nudge" and had_nudge and nudge_in_cooldown:
        _log(db, session.user_id, session.id, "quiet",
             "Already nudged recently; giving it space.", feats.to_dict(), "guardrail")
        return "quiet"

    _log(db, session.user_id, session.id, action, decision.get("justification", ""), feats.to_dict(), source)

    if action == "quiet":
        return "quiet"

    svc = label(session.service)
    if action in ("nudge", "interrupt"):
        msg = decision.get("message") or f"{feats.minutes:.0f} min on {svc}. Worth a pause?"
        audio = voice.synthesize(msg)
        iv = Intervention(user_id=session.user_id, session_id=session.id, kind=action, actor="agent",
                          message=msg, justification=decision.get("justification", ""), audio_url=audio)
        if action == "interrupt":
            iv.expires_at = now + timedelta(minutes=INTERRUPT_MIN)
            apply_interrupt(db, user, session.service)
        db.add(iv)
        session.nudges += 1
        notify.send(db, session.user_id, action, f"{settings.APP_NAME}", msg, audio_url=audio,
                    payload={"service": session.service, "session_id": session.id}, sms=(action == "interrupt"))
        return action

    if action == "escalate" and friend is not None:
        msg = decision.get("message") or f"{user.name} is {feats.ratio_p50:.0f}x their usual on {svc}."
        iv = Intervention(user_id=session.user_id, session_id=session.id, kind="escalate", actor="agent",
                          friend_id=friend.friend_id, message=msg, justification=decision.get("justification", ""))
        db.add(iv)
        session.escalations += 1
        # tell the friend, with the reason they were chosen
        why = f"You get through to {user.name} at this hour more than anyone."
        notify.send(db, friend.friend_id, "escalate", f"{user.name} could use a nudge",
                    f"{msg} {why}", payload={"target_id": user.id, "service": session.service,
                                             "session_id": session.id, "reason": why}, sms=True)
        return "escalate"
    return "quiet"
