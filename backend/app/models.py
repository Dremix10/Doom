from __future__ import annotations

import secrets
import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from .db import Base, utcnow


def new_id() -> str:
    return uuid.uuid4().hex[:16]


def new_token() -> str:
    return secrets.token_urlsafe(24)


def new_client_id() -> str:
    # AdGuard ClientIDs: lowercase letters, digits and hyphens. Keep them short for the DoH URL.
    return "u" + secrets.token_hex(5)


def new_invite_code() -> str:
    alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
    return "".join(secrets.choice(alphabet) for _ in range(6))


class User(Base):
    __tablename__ = "users"
    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=new_id)
    name: Mapped[str] = mapped_column(String(80))
    phone: Mapped[str | None] = mapped_column(String(32), nullable=True)
    client_id: Mapped[str] = mapped_column(String(32), unique=True, default=new_client_id)
    token: Mapped[str] = mapped_column(String(64), unique=True, default=new_token)
    invite_code: Mapped[str] = mapped_column(String(8), unique=True, default=new_invite_code)
    timezone: Mapped[str] = mapped_column(String(48), default="America/Chicago")
    persona_verified: Mapped[bool] = mapped_column(Boolean, default=False)
    simulated: Mapped[bool] = mapped_column(Boolean, default=False)
    last_seen_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)


class Friendship(Base):
    """Stored in both directions so lookups are a single filter."""

    __tablename__ = "friendships"
    user_id: Mapped[str] = mapped_column(String(32), ForeignKey("users.id"), primary_key=True)
    friend_id: Mapped[str] = mapped_column(String(32), ForeignKey("users.id"), primary_key=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)


class ActivityMinute(Base):
    """One row per (user, service, minute) with any DNS activity. Hypertable on Timescale."""

    __tablename__ = "activity_minutes"
    user_id: Mapped[str] = mapped_column(String(32), ForeignKey("users.id"), primary_key=True)
    service: Mapped[str] = mapped_column(String(32), primary_key=True)
    minute: Mapped[datetime] = mapped_column(DateTime, primary_key=True)
    queries: Mapped[int] = mapped_column(Integer, default=1)


class UsageSession(Base):
    __tablename__ = "sessions"
    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=new_id)
    user_id: Mapped[str] = mapped_column(String(32), ForeignKey("users.id"), index=True)
    service: Mapped[str] = mapped_column(String(32))
    started_at: Mapped[datetime] = mapped_column(DateTime, index=True)
    last_active_at: Mapped[datetime] = mapped_column(DateTime)
    ended_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    minutes: Mapped[float] = mapped_column(Float, default=1.0)  # wall-clock minutes, not scaled
    state: Mapped[str] = mapped_column(String(16), default="fine")  # fine | drifting | problem
    problem_score: Mapped[float] = mapped_column(Float, default=0.0)
    nudges: Mapped[int] = mapped_column(Integer, default=0)
    escalations: Mapped[int] = mapped_column(Integer, default=0)

    @property
    def is_open(self) -> bool:
        return self.ended_at is None


class Intervention(Base):
    """Something the agent or a friend did about a session."""

    __tablename__ = "interventions"
    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=new_id)
    user_id: Mapped[str] = mapped_column(String(32), ForeignKey("users.id"), index=True)  # the person scrolling
    session_id: Mapped[str | None] = mapped_column(String(32), ForeignKey("sessions.id"), nullable=True)
    kind: Mapped[str] = mapped_column(String(16))  # nudge | escalate | interrupt | pullout
    actor: Mapped[str] = mapped_column(String(16), default="agent")  # agent | friend
    friend_id: Mapped[str | None] = mapped_column(String(32), ForeignKey("users.id"), nullable=True)
    message: Mapped[str] = mapped_column(Text, default="")
    justification: Mapped[str] = mapped_column(Text, default="")
    audio_url: Mapped[str | None] = mapped_column(String(256), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, index=True)
    expires_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)  # interrupts
    outcome: Mapped[str] = mapped_column(String(16), default="pending")  # pending | success | fail
    evaluated_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)


class FriendStat(Base):
    """How often a friend's intervention ended the user's session, per 4-hour bucket."""

    __tablename__ = "friend_stats"
    user_id: Mapped[str] = mapped_column(String(32), ForeignKey("users.id"), primary_key=True)
    friend_id: Mapped[str] = mapped_column(String(32), ForeignKey("users.id"), primary_key=True)
    hour_bucket: Mapped[int] = mapped_column(Integer, primary_key=True)
    successes: Mapped[int] = mapped_column(Integer, default=0)
    failures: Mapped[int] = mapped_column(Integer, default=0)


class PushSubscription(Base):
    __tablename__ = "push_subscriptions"
    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=new_id)
    user_id: Mapped[str] = mapped_column(String(32), ForeignKey("users.id"), index=True)
    endpoint: Mapped[str] = mapped_column(Text)
    p256dh: Mapped[str] = mapped_column(Text)
    auth: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)


class Notification(Base):
    """In-app inbox. Also what gets pushed. The app polls this when push isn't available."""

    __tablename__ = "notifications"
    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=new_id)
    user_id: Mapped[str] = mapped_column(String(32), ForeignKey("users.id"), index=True)
    kind: Mapped[str] = mapped_column(String(16))  # nudge | escalate | interrupt | pullout | info
    title: Mapped[str] = mapped_column(String(120))
    body: Mapped[str] = mapped_column(Text)
    audio_url: Mapped[str | None] = mapped_column(String(256), nullable=True)
    payload: Mapped[str] = mapped_column(Text, default="{}")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, index=True)
    read_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)


class DecisionLog(Base):
    """Every agent decision, including staying quiet. Shown to the user so the policy is legible."""

    __tablename__ = "decision_logs"
    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=new_id)
    user_id: Mapped[str] = mapped_column(String(32), ForeignKey("users.id"), index=True)
    session_id: Mapped[str | None] = mapped_column(String(32), nullable=True)
    action: Mapped[str] = mapped_column(String(16))
    justification: Mapped[str] = mapped_column(Text, default="")
    features: Mapped[str] = mapped_column(Text, default="{}")
    source: Mapped[str] = mapped_column(String(16), default="fallback")  # gemini | fallback
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, index=True)
