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


class GroupOut(BaseModel):
    id: str
    name: str
    join_code: str
    member_count: int
    members: list[str]        # display names, for the subtitle on the groups list
    is_owner: bool


class CreateGroupIn(BaseModel):
    name: str


class JoinGroupIn(BaseModel):
    join_code: str


class LeaderboardRow(BaseModel):
    id: str
    name: str
    rank: int
    minutes: float          # in the selected window
    ratio: float            # vs this person's own 14-day baseline, 0 when unknown
    state: str              # fine | drifting | problem | offline — live, for the dot
    top_service: str | None  # where most of those minutes went
    is_me: bool


class CategoryOut(BaseModel):
    id: str
    label: str
    blurb: str
    lower_is_better: bool


class LeaderboardOut(BaseModel):
    group_id: str | None
    groups: list[GroupOut]
    category: str
    window: str
    lower_is_better: bool
    categories: list[CategoryOut]   # everything the title menu needs, in one call
    windows: list[str]
    rows: list[LeaderboardRow]


class ServiceMinutes(BaseModel):
    service: str
    label: str
    category: str | None
    today: float
    week: float


class BreakdownOut(BaseModel):
    id: str
    name: str
    is_me: bool
    today_total: float
    week_total: float
    hidden_today: float      # minutes the owner has hidden — counted, not named
    hidden_week: float
    apps: list[ServiceMinutes]


class PrivacyApp(BaseModel):
    service: str
    label: str
    category: str
    visible: bool


class PrivacyOut(BaseModel):
    apps: list[PrivacyApp]


class PrivacyIn(BaseModel):
    hidden: list[str]


class PullOutIn(BaseModel):
    target_id: str
    message: str | None = None


class PushSubIn(BaseModel):
    endpoint: str
    p256dh: str
    auth: str


class HeartbeatIn(BaseModel):
    pass
