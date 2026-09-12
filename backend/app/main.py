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
from datetime import datetime

from fastapi import Depends, FastAPI, Header, HTTPException, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse, FileResponse
from fastapi.staticfiles import StaticFiles
from sqlalchemy import select
from sqlalchemy.orm import Session

from .config import settings
from .db import get_db, init_db, utcnow
from .models import (Friendship, Notification, DecisionLog, Intervention, PushSubscription,
                     UsageSession, User)
from . import schemas
from .services import label
from .sessions import effective_minutes
from .sensor.poller import run_poller
from .sensor.profile import build_mobileconfig, setup_page, doh_url_for
from .agent.loop import run_agent
from .agent import friends as friends_mod

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
        "users": db.scalar(select(__import__("sqlalchemy").func.count(User.id))) or 0,
    }


# ---- onboarding ------------------------------------------------------------

def _user_out(user: User) -> schemas.UserOut:
    return schemas.UserOut(
        id=user.id, name=user.name, client_id=user.client_id, invite_code=user.invite_code,
        token=user.token, persona_verified=user.persona_verified,
        setup_url=f"{settings.PUBLIC_API_URL}/setup/{user.token}", doh_url=doh_url_for(user),
    )


@app.post("/signup", response_model=schemas.UserOut)
def signup(body: schemas.SignupIn, db: Session = Depends(get_db)) -> schemas.UserOut:
    user = User(name=body.name.strip()[:80] or "Anon", phone=(body.phone or None))
    db.add(user)
    db.flush()
    return _user_out(user)


@app.get("/me", response_model=schemas.UserOut)
def me(user: User = Depends(current_user)) -> schemas.UserOut:
    return _user_out(user)


@app.post("/persona/verify", response_model=schemas.UserOut)
def persona_verify(user: User = Depends(current_user), db: Session = Depends(get_db)) -> schemas.UserOut:
    """Stub for the Persona hosted-flow callback. Sandbox always passes for the demo."""
    user.persona_verified = True
    return _user_out(user)


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


@app.post("/friends/pull-out", response_model=schemas.NotificationOut)
def pull_out(body: schemas.PullOutIn, user: User = Depends(current_user), db: Session = Depends(get_db)):
    """A friend manually pulls someone out: notify them and briefly interrupt the app."""
    target = db.get(User, body.target_id)
    if not target or not db.get(Friendship, (user.id, target.id)):
        raise HTTPException(404, "not your friend")
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
