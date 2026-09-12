"""Assemble the feature dict the policy (and Gemini) reason over for an open session."""
from __future__ import annotations

from dataclasses import asdict, dataclass
from datetime import timedelta

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..db import utcnow
from ..models import Intervention, UsageSession
from ..sessions import effective_minutes
from .baseline import Baseline, compute_baseline


@dataclass
class Features:
    user_id: str
    session_id: str
    service: str
    minutes: float           # effective (demo-scaled) session length
    day_total_min: float     # effective minutes on this service today
    p50: float
    p90: float
    ratio_p50: float
    ratio_p90: float
    day_ratio: float
    hour: int
    is_late_night: bool
    consecutive_sessions: int
    minutes_since_intervention: float | None
    prior_nudges_today: int
    cold_start: bool

    def to_dict(self) -> dict:
        return asdict(self)


def _today_service_minutes(db: Session, user_id: str, service: str) -> float:
    start_of_day = utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
    stmt = select(func.coalesce(func.sum(UsageSession.minutes), 0.0)).where(
        UsageSession.user_id == user_id,
        UsageSession.service == service,
        UsageSession.started_at >= start_of_day,
    )
    return float(db.scalar(stmt) or 0.0)


def build_features(db: Session, session: UsageSession) -> tuple[Features, Baseline]:
    now = utcnow()
    baseline = compute_baseline(db, session.user_id, session.service)
    minutes = effective_minutes(session, now)
    day_total = _today_service_minutes(db, session.user_id, session.service) + minutes
    hour = now.hour
    last = db.scalar(
        select(func.max(Intervention.created_at)).where(
            Intervention.user_id == session.user_id, Intervention.session_id == session.id
        )
    )
    mins_since = (now - last).total_seconds() / 60.0 if last else None
    start_of_day = now.replace(hour=0, minute=0, second=0, microsecond=0)
    nudges_today = int(
        db.scalar(
            select(func.count(Intervention.id)).where(
                Intervention.user_id == session.user_id,
                Intervention.created_at >= start_of_day,
                Intervention.actor == "agent",
            )
        )
        or 0
    )
    consecutive = int(
        db.scalar(
            select(func.count(UsageSession.id)).where(
                UsageSession.user_id == session.user_id,
                UsageSession.started_at >= now - timedelta(hours=2),
            )
        )
        or 1
    )
    feats = Features(
        user_id=session.user_id,
        session_id=session.id,
        service=session.service,
        minutes=round(minutes, 1),
        day_total_min=round(day_total, 1),
        p50=round(baseline.p50, 1),
        p90=round(baseline.p90, 1),
        ratio_p50=round(minutes / baseline.p50, 2) if baseline.p50 else 0.0,
        ratio_p90=round(minutes / baseline.p90, 2) if baseline.p90 else 0.0,
        day_ratio=round(day_total / baseline.daily_p50_min, 2) if baseline.daily_p50_min else 0.0,
        hour=hour,
        is_late_night=hour >= 23 or hour < 5,
        consecutive_sessions=consecutive,
        minutes_since_intervention=round(mins_since, 1) if mins_since is not None else None,
        prior_nudges_today=nudges_today,
        cold_start=baseline.cold_start,
    )
    return feats, baseline


def problem_score(f: Features, b: Baseline) -> tuple[float, str]:
    """Deterministic 0..1 score and a state label. This gates the LLM; it never overrides guardrails."""
    pct = b.percentile_of(f.minutes)
    score = pct
    if f.day_ratio > 1.5:
        score += 0.15
    if f.is_late_night:
        score += 0.15
    if f.consecutive_sessions >= 4:
        score += 0.1
    score = max(0.0, min(1.0, score))
    if score >= 0.8:
        state = "problem"
    elif score >= 0.55:
        state = "drifting"
    else:
        state = "fine"
    return round(score, 3), state
