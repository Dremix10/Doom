"""FastAPI app: auth-light REST API for the PWA, plus the sensor and agent loops.

Auth model for the hackathon: each user has an opaque bearer token returned at
signup. Send it as `Authorization: Bearer <token>`. Good enough for a demo; not
production auth.
"""
from __future__ import annotations

import asyncio
import json
import logging
from contextlib import asynccontextmanager
from datetime import datetime, timedelta

from fastapi import Depends, FastAPI, Header, HTTPException, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse, FileResponse
from fastapi.staticfiles import StaticFiles
from sqlalchemy import distinct, func, select
from sqlalchemy.orm import Session

from . import categories as cats
from .config import settings
from .db import get_db, init_db, utcnow
from .models import (ActivityMinute, Credential, Friendship, Group, GroupMember, HiddenService, Notification,
                     QueuedMessage,
                     DecisionLog, Intervention, PushSubscription, UsageSession, User)
from . import schemas
from .passwords import MIN_LENGTH, hash_password, verify_password
from .services import label
from .sessions import effective_minutes
from .sensor.poller import run_poller
from .sensor.profile import build_mobileconfig, setup_page, doh_url_for
from .sensor import shortcuts as shortcuts_mod
from .agent.loop import run_agent
from .agent import friends as friends_mod
from .agent import scheduled as sched

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
log = logging.getLogger("nudge")

_stop = asyncio.Event()
_tasks: list[asyncio.Task] = []


@asynccontextmanager
async def lifespan(_: FastAPI):
    init_db()
    _stop.clear()
    _tasks.append(asyncio.create_task(run_poller(_stop)))
    _tasks.append(asyncio.create_task(run_agent(_stop)))
    log.info("%s API up. sensor=%s gemini=%s demo=%s", settings.APP_NAME,
             settings.sensor_enabled, bool(settings.GEMINI_API_KEY), settings.DEMO_MODE)
    yield
    _stop.set()
    for t in _tasks:
        t.cancel()


app = FastAPI(title=f"{settings.APP_NAME} API", lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])
(settings.DATA_DIR / "media").mkdir(parents=True, exist_ok=True)
app.mount("/media", StaticFiles(directory=str(settings.DATA_DIR / "media")), name="media")


def current_user(authorization: str = Header(default=""), db: Session = Depends(get_db)) -> User:
    token = authorization.removeprefix("Bearer ").strip()
    if not token:
        raise HTTPException(401, "missing token")
    user = db.scalar(select(User).where(User.token == token))
    if not user:
        raise HTTPException(401, "invalid token")
    user.last_seen_at = utcnow()
    return user


# ---- meta ------------------------------------------------------------------

@app.get("/health")
def health(db: Session = Depends(get_db)) -> dict:
    return {
        "ok": True, "app": settings.APP_NAME, "demo_mode": settings.DEMO_MODE,
        "sensor_enabled": settings.sensor_enabled, "gemini": bool(settings.GEMINI_API_KEY),
        "brain": ("claude" if settings.ANTHROPIC_API_KEY else "gemini" if settings.GEMINI_API_KEY else "fallback"),
        "users": db.scalar(select(__import__("sqlalchemy").func.count(User.id))) or 0,
    }


# ---- onboarding ------------------------------------------------------------

def _user_out(user: User, db: Session) -> schemas.UserOut:
    cred = db.get(Credential, user.id)
    return schemas.UserOut(
        id=user.id, name=user.name, email=cred.email if cred else None,
        client_id=user.client_id, invite_code=user.invite_code,
        token=user.token, persona_verified=user.persona_verified,
        setup_url=f"{settings.PUBLIC_API_URL}/setup/{user.token}", doh_url=doh_url_for(user),
        shortcuts_url=f"{settings.PUBLIC_API_URL}/shortcuts/{user.token}",
    )


@app.post("/signup", response_model=schemas.UserOut)
def signup(body: schemas.SignupIn, db: Session = Depends(get_db)) -> schemas.UserOut:
    email = (body.email or "").strip().lower()
    if "@" not in email or "." not in email.split("@")[-1]:
        raise HTTPException(400, "that doesn't look like an email address")
    if len(body.password or "") < MIN_LENGTH:
        raise HTTPException(400, f"password must be at least {MIN_LENGTH} characters")
    if db.scalar(select(Credential).where(Credential.email == email)):
        raise HTTPException(409, "an account with that email already exists")
    user = User(name=body.name.strip()[:80] or "Anon", phone=(body.phone or None))
    db.add(user)
    db.flush()
    db.add(Credential(user_id=user.id, email=email, password_hash=hash_password(body.password)))
    db.flush()
    return _user_out(user, db)


@app.post("/login", response_model=schemas.UserOut)
def login(body: schemas.LoginIn, db: Session = Depends(get_db)) -> schemas.UserOut:
    email = (body.email or "").strip().lower()
    cred = db.scalar(select(Credential).where(Credential.email == email))
    # Same message either way: don't confirm which emails have accounts.
    if not cred or not verify_password(body.password or "", cred.password_hash):
        raise HTTPException(401, "wrong email or password")
    user = db.get(User, cred.user_id)
    if not user:
        raise HTTPException(401, "wrong email or password")
    user.last_seen_at = utcnow()
    db.flush()
    return _user_out(user, db)


@app.get("/me", response_model=schemas.UserOut)
def me(user: User = Depends(current_user), db: Session = Depends(get_db)) -> schemas.UserOut:
    return _user_out(user, db)


@app.post("/persona/verify", response_model=schemas.UserOut)
def persona_verify(user: User = Depends(current_user), db: Session = Depends(get_db)) -> schemas.UserOut:
    """Stub for the Persona hosted-flow callback. Sandbox always passes for the demo."""
    user.persona_verified = True
    return _user_out(user, db)


@app.get("/setup/{token}", response_class=HTMLResponse)
def setup(token: str, db: Session = Depends(get_db)) -> str:
    user = db.scalar(select(User).where(User.token == token))
    if not user:
        raise HTTPException(404, "unknown setup link")
    return setup_page(user, profile_url=f"{settings.PUBLIC_API_URL}/profile/{token}.mobileconfig")


@app.get("/profile/{token}.mobileconfig")
def profile(token: str, db: Session = Depends(get_db)) -> Response:
    user = db.scalar(select(User).where(User.token == token))
    if not user:
        raise HTTPException(404, "unknown profile link")
    data = build_mobileconfig(user)
    return Response(content=data, media_type="application/x-apple-aspen-config",
                    headers={"Content-Disposition": f'attachment; filename="{settings.APP_NAME}.mobileconfig"'})


# ---- friends ---------------------------------------------------------------

@app.post("/friends/add", response_model=schemas.FriendState)
def add_friend(body: schemas.AddFriendIn, user: User = Depends(current_user), db: Session = Depends(get_db)):
    friend = db.scalar(select(User).where(User.invite_code == body.invite_code.strip().upper()))
    if not friend:
        raise HTTPException(404, "no one has that invite code")
    if friend.id == user.id:
        raise HTTPException(400, "that's your own code")
    for a, b in ((user.id, friend.id), (friend.id, user.id)):
        if not db.get(Friendship, (a, b)):
            db.add(Friendship(user_id=a, friend_id=b))
    db.flush()
    return _friend_state(db, friend)


def _friend_state(db: Session, friend: User) -> schemas.FriendState:
    now = utcnow()
    session = db.scalar(select(UsageSession).where(
        UsageSession.user_id == friend.id, UsageSession.ended_at.is_(None)
    ).order_by(UsageSession.started_at.desc()).limit(1))
    last_seen_min = (now - friend.last_seen_at).total_seconds() / 60.0 if friend.last_seen_at else None
    if session:
        minutes = effective_minutes(session, now)
        from .agent.features import build_features, problem_score
        feats, base = build_features(db, session)
        _, state = problem_score(feats, base)
        return schemas.FriendState(id=friend.id, name=friend.name, state=state,
                                   service=session.service, minutes=round(minutes, 1),
                                   ratio=feats.ratio_p50, last_seen_min=last_seen_min)
    state = "offline" if (last_seen_min is None or last_seen_min > 20) else "fine"
    return schemas.FriendState(id=friend.id, name=friend.name, state=state, service=None,
                               minutes=0.0, ratio=0.0, last_seen_min=last_seen_min)


@app.get("/friends", response_model=list[schemas.FriendState])
def list_friends(user: User = Depends(current_user), db: Session = Depends(get_db)):
    ids = list(db.scalars(select(Friendship.friend_id).where(Friendship.user_id == user.id)))
    return [_friend_state(db, db.get(User, fid)) for fid in ids if db.get(User, fid)]


# ---- groups ----------------------------------------------------------------

# Sentinel group id meaning "everyone I've added", groups or not.
ALL_GROUPS = "all"

def _group_out(db: Session, group: Group, user: User) -> schemas.GroupOut:
    member_ids = list(db.scalars(select(GroupMember.user_id).where(GroupMember.group_id == group.id)))
    names = [u.name for u in (db.get(User, i) for i in member_ids) if u]
    return schemas.GroupOut(id=group.id, name=group.name, join_code=group.join_code,
                            member_count=len(member_ids), members=names,
                            is_owner=group.created_by == user.id)


def _my_groups(db: Session, user: User) -> list[Group]:
    ids = list(db.scalars(select(GroupMember.group_id).where(GroupMember.user_id == user.id)))
    groups = [g for g in (db.get(Group, i) for i in ids) if g]
    groups.sort(key=lambda g: g.created_at)
    return groups


def _shares_a_group(db: Session, a: User, b: User) -> bool:
    mine = set(db.scalars(select(GroupMember.group_id).where(GroupMember.user_id == a.id)))
    theirs = set(db.scalars(select(GroupMember.group_id).where(GroupMember.user_id == b.id)))
    return bool(mine & theirs)


@app.get("/groups", response_model=list[schemas.GroupOut])
def list_groups(user: User = Depends(current_user), db: Session = Depends(get_db)):
    return [_group_out(db, g, user) for g in _my_groups(db, user)]


@app.post("/groups", response_model=schemas.GroupOut)
def create_group(body: schemas.CreateGroupIn, user: User = Depends(current_user),
                 db: Session = Depends(get_db)):
    name = (body.name or "").strip()[:60] or "New group"
    group = Group(name=name, created_by=user.id)
    db.add(group)
    db.flush()
    db.add(GroupMember(group_id=group.id, user_id=user.id))
    db.flush()
    return _group_out(db, group, user)


@app.post("/groups/join", response_model=schemas.GroupOut)
def join_group(body: schemas.JoinGroupIn, user: User = Depends(current_user),
               db: Session = Depends(get_db)):
    code = (body.join_code or "").strip().upper()
    group = db.scalar(select(Group).where(Group.join_code == code))
    if not group:
        raise HTTPException(404, "no group with that code")
    if not db.get(GroupMember, (group.id, user.id)):
        db.add(GroupMember(group_id=group.id, user_id=user.id))
        db.flush()
        # Co-members become friends so the agent can escalate to them and they can
        # pull you out — escalation and pull-out both run on the friendship graph.
        for mid in list(db.scalars(select(GroupMember.user_id).where(GroupMember.group_id == group.id))):
            if mid == user.id:
                continue
            for a, b in ((user.id, mid), (mid, user.id)):
                if not db.get(Friendship, (a, b)):
                    db.add(Friendship(user_id=a, friend_id=b))
        db.flush()
    return _group_out(db, group, user)


@app.post("/groups/{group_id}/leave")
def leave_group(group_id: str, user: User = Depends(current_user), db: Session = Depends(get_db)):
    member = db.get(GroupMember, (group_id, user.id))
    if member:
        db.delete(member)
        db.flush()
    return {"ok": True}


# ---- per-app breakdown and privacy -----------------------------------------

def _hidden_for(db: Session, user_id: str) -> set[str]:
    return set(db.scalars(select(HiddenService.service).where(HiddenService.user_id == user_id)))


def _minutes_by_service(db: Session, user_id: str, start: datetime,
                        end: datetime) -> dict[str, float]:
    rows = db.execute(
        select(ActivityMinute.service, func.count())
        .where(ActivityMinute.user_id == user_id,
               ActivityMinute.minute >= start,
               ActivityMinute.minute < end)
        .group_by(ActivityMinute.service)
    ).all()
    return {service: float(n) for service, n in rows}


@app.get("/people/{user_id}/breakdown", response_model=schemas.BreakdownOut)
def breakdown(user_id: str, user: User = Depends(current_user), db: Session = Depends(get_db)):
    """Exactly where someone's time went today and over the last 7 days.

    Apps the person has hidden are folded into `hidden_today` / `hidden_week`
    rather than dropped, so the totals still reconcile with their rank.
    """
    person = db.get(User, user_id)
    is_me = person is not None and person.id == user.id
    reachable = person and (is_me or db.get(Friendship, (user.id, person.id))
                            or _shares_a_group(db, user, person))
    if not reachable:
        raise HTTPException(404, "not in any of your groups")

    now = utcnow()
    today_start, _ = _window_bounds(now, 1)
    week_start, _ = _window_bounds(now, 7)
    today = _minutes_by_service(db, person.id, today_start, now)
    week = _minutes_by_service(db, person.id, week_start, now)
    hidden = set() if is_me else _hidden_for(db, person.id)

    apps = [
        schemas.ServiceMinutes(
            service=svc, label=cats.LABELS.get(svc) or label(svc),
            category=cats.service_category(svc),
            today=today.get(svc, 0.0), week=week.get(svc, 0.0),
        )
        for svc in sorted(set(today) | set(week), key=lambda s: -week.get(s, 0.0))
        if svc not in hidden
    ]
    return schemas.BreakdownOut(
        id=person.id, name=person.name, is_me=is_me,
        today_total=sum(today.values()), week_total=sum(week.values()),
        hidden_today=sum(v for k, v in today.items() if k in hidden),
        hidden_week=sum(v for k, v in week.items() if k in hidden),
        apps=apps,
    )


@app.get("/privacy", response_model=schemas.PrivacyOut)
def get_privacy(user: User = Depends(current_user), db: Session = Depends(get_db)):
    hidden = _hidden_for(db, user.id)
    apps = [
        schemas.PrivacyApp(service=svc, label=cats.LABELS.get(svc) or label(svc),
                           category=key, visible=svc not in hidden)
        for key, meta in cats.CATEGORIES.items() if key != "total"
        for svc in meta["services"]
    ]
    return schemas.PrivacyOut(apps=apps)


@app.post("/privacy", response_model=schemas.PrivacyOut)
def set_privacy(body: schemas.PrivacyIn, user: User = Depends(current_user),
                db: Session = Depends(get_db)):
    wanted = {s for s in body.hidden if s in cats.ALL_SERVICES}
    for row in db.scalars(select(HiddenService).where(HiddenService.user_id == user.id)).all():
        if row.service not in wanted:
            db.delete(row)
    existing = _hidden_for(db, user.id)
    for svc in wanted - existing:
        db.add(HiddenService(user_id=user.id, service=svc))
    db.flush()
    return get_privacy(user=user, db=db)


# ---- leaderboard -----------------------------------------------------------

def _window_bounds(now: datetime, days: int) -> tuple[datetime, datetime]:
    """`today` runs from midnight so it resets like a screen-time day; longer
    windows are rolling, which keeps them full of seeded history."""
    if days == 1:
        return now.replace(hour=0, minute=0, second=0, microsecond=0), now
    return now - timedelta(days=days), now


def _active_minutes(db: Session, user_ids: list[str], services: list[str],
                    start: datetime, end: datetime) -> dict[str, float]:
    """Distinct minutes of activity per user. Counting distinct minutes (rather
    than rows) means two apps in the same minute is one minute of screen time."""
    rows = db.execute(
        select(ActivityMinute.user_id, func.count(distinct(ActivityMinute.minute)))
        .where(ActivityMinute.user_id.in_(user_ids),
               ActivityMinute.service.in_(services),
               ActivityMinute.minute >= start,
               ActivityMinute.minute < end)
        .group_by(ActivityMinute.user_id)
    ).all()
    return {uid: float(n) for uid, n in rows}


def _top_services(db: Session, user_ids: list[str], services: list[str],
                  start: datetime, end: datetime) -> dict[str, str]:
    rows = db.execute(
        select(ActivityMinute.user_id, ActivityMinute.service, func.count())
        .where(ActivityMinute.user_id.in_(user_ids),
               ActivityMinute.service.in_(services),
               ActivityMinute.minute >= start,
               ActivityMinute.minute < end)
        .group_by(ActivityMinute.user_id, ActivityMinute.service)
    ).all()
    best: dict[str, tuple[str, int]] = {}
    for uid, service, n in rows:
        if uid not in best or n > best[uid][1]:
            best[uid] = (service, n)
    return {uid: service for uid, (service, _) in best.items()}


@app.get("/leaderboard", response_model=schemas.LeaderboardOut)
def leaderboard(group_id: str | None = None, category: str | None = None,
                window: str | None = None, user: User = Depends(current_user),
                db: Session = Depends(get_db)):
    """Rank one group within one category — a league table.

    Rank 1 is always the position you want: least time for social, entertainment
    and total; most time for productivity. `ratio` compares each person to their
    own 14-day baseline, so the board still reflects the "your own normal" idea
    even though the ordering is absolute minutes.

    Groups decide who is on the board. Someone with no groups yet still gets a
    board of whoever they've added, so the screen is never empty.
    """
    cat_id, cat = cats.category(category)
    win_id, days = cats.window_days(window)
    services = cat["services"]
    now = utcnow()
    start, end = _window_bounds(now, days)

    groups = _my_groups(db, user)
    # `all` is an explicit choice, not just the no-groups fallback: some friends
    # aren't in any group, and you still want to see them ranked.
    if group_id == ALL_GROUPS:
        group = None
    else:
        group = next((g for g in groups if g.id == group_id), None) or (groups[0] if groups else None)
    if group:
        member_ids = list(db.scalars(
            select(GroupMember.user_id).where(GroupMember.group_id == group.id)))
        people = [u for u in (db.get(User, i) for i in member_ids) if u]
    else:
        friend_ids = list(db.scalars(
            select(Friendship.friend_id).where(Friendship.user_id == user.id)))
        people = [user] + [f for f in (db.get(User, fid) for fid in friend_ids) if f]
    ids = [p.id for p in people]

    minutes = _active_minutes(db, ids, services, start, end)
    tops = _top_services(db, ids, services, start, end)

    # Baseline: the same stretch of days immediately before this window.
    base_start = start - timedelta(days=cats.BASELINE_DAYS)
    base_total = _active_minutes(db, ids, services, base_start, start)
    expected = {uid: (base_total.get(uid, 0.0) / cats.BASELINE_DAYS) * days for uid in ids}

    rows = []
    for p in people:
        mins = minutes.get(p.id, 0.0)
        exp = expected.get(p.id, 0.0)
        top = tops.get(p.id)
        # The minutes still count; we just don't say which app they were.
        if top and p.id != user.id and top in _hidden_for(db, p.id):
            top = None
        rows.append(schemas.LeaderboardRow(
            id=p.id, name=p.name, rank=0, minutes=round(mins, 1),
            ratio=round(mins / exp, 2) if exp > 0 else 0.0,
            state=_friend_state(db, p).state, top_service=top,
            is_me=(p.id == user.id),
        ))

    rows.sort(key=lambda r: (r.minutes if cat["lower_is_better"] else -r.minutes, r.name))
    for i, r in enumerate(rows, start=1):
        r.rank = i

    return schemas.LeaderboardOut(
        group_id=group.id if group else ALL_GROUPS,
        groups=[_group_out(db, g, user) for g in groups],
        category=cat_id, window=win_id, lower_is_better=cat["lower_is_better"],
        categories=[schemas.CategoryOut(id=k, label=v["label"], blurb=v["blurb"],
                                        lower_is_better=v["lower_is_better"])
                    for k, v in cats.CATEGORIES.items()],
        windows=list(cats.WINDOWS),
        rows=rows,
    )


@app.post("/friends/pull-out", response_model=schemas.NotificationOut)
def pull_out(body: schemas.PullOutIn, user: User = Depends(current_user), db: Session = Depends(get_db)):
    """A friend manually pulls someone out: notify them and briefly interrupt the app."""
    target = db.get(User, body.target_id)
    reachable = target and (db.get(Friendship, (user.id, target.id)) or _shares_a_group(db, user, target))
    if not reachable:
        raise HTTPException(404, "not in any of your groups")
    session = db.scalar(select(UsageSession).where(
        UsageSession.user_id == target.id, UsageSession.ended_at.is_(None)
    ).order_by(UsageSession.started_at.desc()).limit(1))
    from .delivery import notify as notify_mod
    from .agent.policy import apply_interrupt, INTERRUPT_MIN
    from datetime import timedelta
    msg = (body.message or f"{user.name} says: put the phone down 🙂")
    iv = Intervention(user_id=target.id, session_id=session.id if session else None, kind="pullout",
                      actor="friend", friend_id=user.id, message=msg,
                      justification=f"{user.name} pulled {target.name} out.",
                      expires_at=utcnow() + timedelta(minutes=INTERRUPT_MIN))
    db.add(iv)
    if session:
        apply_interrupt(db, target, session.service)
    note = notify_mod.send(db, target.id, "pullout", f"{user.name} pulled you out",
                           msg, payload={"from": user.name, "from_id": user.id}, sms=True)
    return _note_out(note)


# ---- scheduled messages ----------------------------------------------------

@app.post("/messages/queue", response_model=schemas.QueuedMessageOut)
def queue_message(body: schemas.QueueMessageIn, user: User = Depends(current_user),
                  db: Session = Depends(get_db)):
    """Leave a message for a friend; the agent picks when it lands.

    Delivery is decided in agent/scheduled.py — next time they're doomscrolling,
    or their historically worst stretch of the day, whichever comes first.
    """
    target = db.get(User, body.target_id)
    reachable = target and (db.get(Friendship, (user.id, target.id)) or _shares_a_group(db, user, target))
    if not reachable:
        raise HTTPException(404, "not in any of your groups")
    if target.id == user.id:
        raise HTTPException(400, "leave a message for a friend, not yourself")
    text = (body.text or "").strip()[:280]
    if not text:
        raise HTTPException(400, "the message is empty")

    msg = QueuedMessage(from_user_id=user.id, to_user_id=target.id, text=text,
                        expires_at=sched.expires_after())
    db.add(msg)
    db.flush()
    return schemas.QueuedMessageOut(id=msg.id, to_id=target.id, to_name=target.name, text=msg.text,
                                    status=msg.status, created_at=msg.created_at,
                                    expires_at=msg.expires_at)


# ---- feed / notifications --------------------------------------------------

def _note_out(n: Notification) -> schemas.NotificationOut:
    return schemas.NotificationOut(id=n.id, kind=n.kind, title=n.title, body=n.body,
                                   audio_url=n.audio_url, payload=json.loads(n.payload or "{}"),
                                   created_at=n.created_at, read_at=n.read_at)


@app.get("/notifications", response_model=list[schemas.NotificationOut])
def notifications(unread: bool = False, user: User = Depends(current_user), db: Session = Depends(get_db)):
    stmt = select(Notification).where(Notification.user_id == user.id)
    if unread:
        stmt = stmt.where(Notification.read_at.is_(None))
    stmt = stmt.order_by(Notification.created_at.desc()).limit(50)
    return [_note_out(n) for n in db.scalars(stmt)]


@app.post("/notifications/{note_id}/read")
def mark_read(note_id: str, user: User = Depends(current_user), db: Session = Depends(get_db)) -> dict:
    n = db.get(Notification, note_id)
    if not n or n.user_id != user.id:
        raise HTTPException(404, "not found")
    n.read_at = utcnow()
    return {"ok": True}


@app.get("/me/timeline", response_model=list[schemas.DecisionOut])
def timeline(user: User = Depends(current_user), db: Session = Depends(get_db)):
    """The agent's decision log for this user: why it stayed quiet or spoke up."""
    rows = db.scalars(select(DecisionLog).where(DecisionLog.user_id == user.id)
                      .order_by(DecisionLog.created_at.desc()).limit(50))
    out = []
    for r in rows:
        feats = json.loads(r.features or "{}")
        out.append(schemas.DecisionOut(id=r.id, action=r.action, justification=r.justification,
                                       service=feats.get("service"), source=r.source, created_at=r.created_at))
    return out


@app.get("/me/status")
def my_status(user: User = Depends(current_user), db: Session = Depends(get_db)) -> dict:
    """What the current user's own phone is doing right now, for the home screen."""
    return _friend_state(db, user).model_dump()


# ---- push / heartbeat ------------------------------------------------------

@app.post("/push/subscribe")
def push_subscribe(body: schemas.PushSubIn, user: User = Depends(current_user), db: Session = Depends(get_db)) -> dict:
    exists = db.scalar(select(PushSubscription).where(PushSubscription.user_id == user.id,
                                                      PushSubscription.endpoint == body.endpoint))
    if not exists:
        db.add(PushSubscription(user_id=user.id, endpoint=body.endpoint, p256dh=body.p256dh, auth=body.auth))
    return {"ok": True, "vapid_public_key": settings.VAPID_PUBLIC_KEY}


@app.post("/heartbeat")
def heartbeat(user: User = Depends(current_user)) -> dict:
    return {"ok": True, "seen": utcnow().isoformat()}


# ---- Shortcuts ingestion (real iOS usage, no profile/account) ---------------

@app.get("/shortcuts/{token}", response_class=HTMLResponse)
def shortcuts_setup(token: str, db: Session = Depends(get_db)) -> str:
    user = db.scalar(select(User).where(User.token == token))
    if not user:
        raise HTTPException(404, "unknown setup link")
    return shortcuts_mod.setup_page(user, settings.PUBLIC_API_URL, settings.APP_NAME)


@app.api_route("/s/{token}/{app_name}/{event}", methods=["GET", "POST"])
def shortcut_event(token: str, app_name: str, event: str, db: Session = Depends(get_db)) -> dict:
    """Called by an iOS Shortcuts automation on app open/close. Kept dead simple
    (path-only, no body/headers) so the Shortcut is just 'Get Contents of URL'."""
    user = db.scalar(select(User).where(User.token == token))
    if not user:
        raise HTTPException(404, "unknown link")
    user.last_seen_at = utcnow()
    service = shortcuts_mod.normalize_service(app_name)
    if not service:
        raise HTTPException(400, f"unknown app '{app_name}'")
    ev = event.strip().lower()
    if ev in ("open", "opened", "start"):
        s = shortcuts_mod.open_shortcut_session(db, user, service)
        return {"ok": True, "event": "open", "service": service, "session": s.id}
    if ev in ("close", "closed", "stop", "end"):
        s = shortcuts_mod.close_shortcut_session(db, user, service)
        return {"ok": True, "event": "close", "service": service,
                "minutes": round(s.minutes, 1) if s else 0, "closed": bool(s)}
    raise HTTPException(400, f"unknown event '{event}' (use open or close)")


@app.get("/push/config")
def push_config() -> dict:
    """Public: the VAPID public key the browser needs to subscribe to Web Push,
    and whether the server is configured to send. No auth (needed before login)."""
    return {"vapid_public_key": settings.VAPID_PUBLIC_KEY, "enabled": bool(settings.VAPID_PRIVATE_KEY)}
