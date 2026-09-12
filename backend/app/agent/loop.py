"""The agent loop: every AGENT_INTERVAL_S, refresh sessions, evaluate each open
session, clear expired interrupts, and score intervention outcomes.
"""
from __future__ import annotations

import asyncio
import logging

from ..config import settings
from ..db import db_session, utcnow
from ..sessions import open_sessions, refresh_sessions
from .policy import act_on_session, clear_expired_interrupts, evaluate_outcomes

log = logging.getLogger(__name__)


def tick() -> dict:
    actions: dict[str, int] = {}
    with db_session() as db:
        refresh_sessions(db, utcnow())
        clear_expired_interrupts(db)
        evaluate_outcomes(db)
        for session in open_sessions(db):
            action = act_on_session(db, session)
            actions[action] = actions.get(action, 0) + 1
    return actions


async def run_agent(stop: asyncio.Event) -> None:
    log.info("agent loop started, interval %ss (demo_mode=%s)", settings.AGENT_INTERVAL_S, settings.DEMO_MODE)
    while not stop.is_set():
        try:
            actions = await asyncio.to_thread(tick)
            if actions and set(actions) - {"quiet"}:
                log.info("agent tick: %s", actions)
        except Exception as exc:
            log.warning("agent tick error: %s", exc)
        try:
            await asyncio.wait_for(stop.wait(), timeout=settings.AGENT_INTERVAL_S)
        except asyncio.TimeoutError:
            pass
