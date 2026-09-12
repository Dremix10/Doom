from __future__ import annotations

from datetime import datetime
from pydantic import BaseModel


class SignupIn(BaseModel):
    name: str
    phone: str | None = None


class UserOut(BaseModel):
    id: str
    name: str
    client_id: str
    invite_code: str
    token: str
    persona_verified: bool
    setup_url: str
    doh_url: str
    shortcuts_url: str


class FriendState(BaseModel):
    id: str
    name: str
    state: str            # fine | drifting | problem | offline
    service: str | None
    minutes: float
    ratio: float
    last_seen_min: float | None


class AddFriendIn(BaseModel):
    invite_code: str


class NotificationOut(BaseModel):
    id: str
    kind: str
    title: str
    body: str
    audio_url: str | None
    payload: dict
    created_at: datetime
    read_at: datetime | None


class DecisionOut(BaseModel):
    id: str
    action: str
    justification: str
    service: str | None
    source: str
    created_at: datetime


class PullOutIn(BaseModel):
    target_id: str
    message: str | None = None


class PushSubIn(BaseModel):
    endpoint: str
    p256dh: str
    auth: str


class HeartbeatIn(BaseModel):
    pass
