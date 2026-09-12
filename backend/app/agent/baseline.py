"""Per-user, per-service baselines from ActivityMinute history.

The whole product hinges on "your own baseline", so this is deliberately simple
and explainable: we look at completed sessions over the last 14 days and take
percentiles of their length. Cold start (fewer than MIN_SESSIONS) falls back to a
population prior so the agent behaves sanely on day one.
"""
from __future__ import annotations

from dataclasses import dataclass
from datetime import timedelta

import numpy as np
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..db import utcnow
from ..models import UsageSession

LOOKBACK_DAYS = 14
MIN_SESSIONS = 5

# Population prior for session length in minutes (p50, p90) before we know the user.
PRIOR = {
    "default": (6.0, 25.0),
    "tiktok": (9.0, 40.0),
    "instagram": (7.0, 30.0),
    "youtube": (12.0, 45.0),
    "reddit": (8.0, 32.0),
    "twitter": (6.0, 28.0),
}


@dataclass
class Baseline:
    p50: float
    p90: float
    daily_p50_min: float
    n_sessions: int
    cold_start: bool

    def percentile_of(self, minutes: float) -> float:
        """Rough percentile of a session length against this baseline (0..1)."""
        if minutes <= self.p50:
            return 0.5 * (minutes / self.p50) if self.p50 > 0 else 0.0
        if minutes <= self.p90:
            return 0.5 + 0.4 * (minutes - self.p50) / max(1e-6, self.p90 - self.p50)
        # beyond p90 saturates toward 1
        return min(0.99, 0.9 + 0.09 * (minutes - self.p90) / max(1e-6, self.p90))


def compute_baseline(db: Session, user_id: str, service: str) -> Baseline:
    since = utcnow() - timedelta(days=LOOKBACK_DAYS)
    stmt = (
        select(UsageSession.minutes, UsageSession.started_at)
        .where(
            UsageSession.user_id == user_id,
            UsageSession.service == service,
            UsageSession.ended_at.is_not(None),
            UsageSession.started_at >= since,
        )
    )
    rows = list(db.execute(stmt))
    lengths = np.array([r[0] for r in rows], dtype=float)
    prior = PRIOR.get(service, PRIOR["default"])
    if len(lengths) < MIN_SESSIONS:
        return Baseline(p50=prior[0], p90=prior[1], daily_p50_min=prior[0] * 3, n_sessions=len(lengths), cold_start=True)

    p50 = float(np.percentile(lengths, 50))
    p90 = float(np.percentile(lengths, 90))
    # daily totals
    by_day: dict[str, float] = {}
    for minutes, started in rows:
        day = started.date().isoformat()
        by_day[day] = by_day.get(day, 0.0) + minutes
    daily_p50 = float(np.percentile(np.array(list(by_day.values())), 50)) if by_day else prior[0] * 3
    return Baseline(
        p50=max(2.0, p50),
        p90=max(p50 + 2.0, p90),
        daily_p50_min=daily_p50,
        n_sessions=len(lengths),
        cold_start=False,
    )
