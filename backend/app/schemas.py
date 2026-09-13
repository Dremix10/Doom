from __future__ import annotations

from datetime import datetime
from typing import Annotated
from pydantic import BaseModel, PlainSerializer

# Serialize naive UTC datetimes with a trailing Z so browsers parse them as UTC
# rather than local time (otherwise "x ago" goes negative and shows "0s ago").
UTCDatetime = Annotated[datetime, PlainSerializer(
    lambda v: v.isoformat() + ("Z" if v.tzinfo is None else ""),
    return_type=str, when_used="json")]



class SignupIn(BaseModel):
    name: str
    email: str
    password: str
    phone: str | None = None


class LoginIn(BaseModel):
    email: str
    password: str


class UserOut(BaseModel):
    id: str
    name: str
    email: str | None
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
    shared_groups: list[str] = []   # empty means removing them actually does something
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
    created_at: UTCDatetime
    read_at: UTCDatetime | None


class DecisionOut(BaseModel):
    id: str
    action: str
    justification: str
    service: str | None
    source: str
    created_at: UTCDatetime


class GroupOut(BaseModel):
    id: str
    name: str
    join_code: str
    member_count: int
    members: list[str]        # display names, for the subtitle on the groups list
    member_ids: list[str]     # so the invite picker can skip people already in
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
    is_friend: bool
    shared_groups: list[str]   # names; removing a friend you share a group with
                               # is a no-op, so the sheet says so instead
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


class InviteIn(BaseModel):
    friend_id: str


class PullOutIn(BaseModel):
    target_id: str
    message: str | None = None


class QueueMessageIn(BaseModel):
    target_id: str
    text: str


class QueuedMessageOut(BaseModel):
    id: str
    to_id: str
    to_name: str
    text: str
    status: str
    created_at: UTCDatetime
    expires_at: UTCDatetime


class PushSubIn(BaseModel):
    endpoint: str
    p256dh: str
    auth: str


class HeartbeatIn(BaseModel):
    pass
