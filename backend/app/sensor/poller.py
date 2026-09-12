"""Poll AdGuard's query log and turn it into activity minutes.

Runs as a background task inside the API process. Raw hostnames never touch the
database: they are classified in memory and only (user, service, minute) is kept.
"""
from __future__ import annotations

import asyncio
import logging
from datetime import datetime, timedelta

from sqlalchemy import select

from ..config import settings
from ..db import db_session, utcnow
from ..models import User
from ..services import classify
from ..sessions import record_activity, refresh_sessions
from .adguard import adguard

log = logging.getLogger(__name__)


class PollState:
    def __init__(self) -> None:
        self.last_time: datetime | None = None
        self.seen: set[tuple[str, str, str]] = set()  # (time, client_id, name) within the current minute


def poll_once(state: PollState) -> int:
    ag = adguard()
    items = ag.fetch_recent(limit=1000)
    if not items:
        return 0
    with db_session() as db:
        by_client = {u.client_id: u.id for u in db.scalars(select(User))}
        added = 0
        newest: datetime | None = state.last_time
        for item in items:
            client_id = item.get("client_id") or ""
            name = (item.get("question") or {}).get("name") or ""
            ts_raw = item.get("time") or ""
            if not client_id or not name or not ts_raw:
                continue
            ts = ag.parse_time(ts_raw)
            if state.last_time and ts < state.last_time - timedelta(seconds=90):
                break  # log is newest-first; we've reached what we already processed
            key = (ts_raw, client_id, name)
            if key in state.seen:
                continue
            state.seen.add(key)
            user_id = by_client.get(client_id)
            service = classify(name)
            if user_id and service:
                record_activity(db, user_id, service, ts)
                added += 1
            if newest is None or ts > newest:
                newest = ts
        state.last_time = newest
        # keep the dedupe set small
        if len(state.seen) > 20000:
            state.seen = set(list(state.seen)[-5000:])
        refresh_sessions(db, utcnow())
    return added


async def run_poller(stop: asyncio.Event) -> None:
    if not settings.sensor_enabled:
        log.info("sensor disabled (ADGUARD_URL empty); poller not started")
        return
    state = PollState()
    log.info("sensor poller started against %s every %ss", settings.ADGUARD_URL, settings.POLL_INTERVAL_S)
    while not stop.is_set():
        try:
            n = await asyncio.to_thread(poll_once, state)
            if n:
                log.debug("poller: %d new activity rows", n)
        except Exception as exc:  # never let the sensor kill the API
            log.warning("poller error: %s", exc)
        try:
            await asyncio.wait_for(stop.wait(), timeout=settings.POLL_INTERVAL_S)
        except asyncio.TimeoutError:
            pass
