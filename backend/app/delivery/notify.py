"""Deliver a notification: persist to the in-app inbox, then best-effort Web Push
and SMS. The inbox row is the source of truth the app polls; push/SMS are extras.
"""
from __future__ import annotations

import json
import logging

from sqlalchemy import select
from sqlalchemy.orm import Session

from ..config import settings
from ..models import Notification, PushSubscription, User

log = logging.getLogger(__name__)


def _web_push(db: Session, user_id: str, title: str, body: str, payload: dict) -> None:
    if not settings.VAPID_PRIVATE_KEY:
        return
    try:
        from pywebpush import webpush, WebPushException

        subs = list(db.scalars(select(PushSubscription).where(PushSubscription.user_id == user_id)))
        data = json.dumps({"title": title, "body": body, **payload})
        seen: set[str] = set()
        for sub in subs:
            if sub.endpoint in seen:  # duplicate row for one device -> one banner, not two
                db.delete(sub)
                continue
            seen.add(sub.endpoint)
            try:
                webpush(
                    subscription_info={"endpoint": sub.endpoint, "keys": {"p256dh": sub.p256dh, "auth": sub.auth}},
                    data=data,
                    vapid_private_key=settings.VAPID_PRIVATE_KEY,
                    vapid_claims={"sub": settings.VAPID_SUBJECT},
                )
            except WebPushException as exc:
                code = getattr(getattr(exc, "response", None), "status_code", None)
                if code in (404, 410):  # expired/unsubscribed -> remove the stale row
                    db.delete(sub)
                else:
                    log.info("web push to one endpoint failed: %s", exc)
            except Exception as exc:
                log.info("web push to one endpoint failed: %s", exc)
    except Exception as exc:
        log.warning("web push unavailable: %s", exc)


def _sms(user: User, body: str) -> None:
    if not (settings.TWILIO_ACCOUNT_SID and user.phone):
        return
    try:
        from twilio.rest import Client

        Client(settings.TWILIO_ACCOUNT_SID, settings.TWILIO_AUTH_TOKEN).messages.create(
            body=body, from_=settings.TWILIO_FROM, to=user.phone
        )
    except Exception as exc:
        log.warning("twilio sms failed: %s", exc)


def send(db: Session, user_id: str, kind: str, title: str, body: str,
         audio_url: str | None = None, payload: dict | None = None, sms: bool = False) -> Notification:
    payload = payload or {}
    note = Notification(user_id=user_id, kind=kind, title=title, body=body,
                        audio_url=audio_url, payload=json.dumps(payload))
    db.add(note)
    db.flush()
    _web_push(db, user_id, title, body, {"kind": kind, "audio_url": audio_url, **payload})
    if sms:
        user = db.get(User, user_id)
        if user:
            _sms(user, f"{title}: {body}")
    return note
