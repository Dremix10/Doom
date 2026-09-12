"""Gemini decision call. Returns a structured decision, with a deterministic
fallback so the agent works with no API key (dev, offline, or if the call fails).
"""
from __future__ import annotations

import json
import logging

from ..config import settings
from ..services import label
from .features import Features

log = logging.getLogger(__name__)

DECISION_SCHEMA = {
    "type": "object",
    "properties": {
        "action": {"type": "string", "enum": ["quiet", "nudge", "escalate", "interrupt"]},
        "message": {"type": "string"},
        "justification": {"type": "string"},
    },
    "required": ["action", "justification"],
}

SYSTEM = """You are the policy brain of a zero-settings screen-time accountability app.
A friend group opted in. You watch each person's usage against THEIR OWN baseline, not fixed limits.
Your only job: decide whether to stay quiet, send a gentle nudge, escalate to a friend, or (last resort) briefly interrupt the app.
Principles:
- Most of the time, stay quiet. Only act when this session is clearly unusual for THIS person.
- A nudge is a short, warm, non-preachy line (max 140 chars). Never shame. Never mention "limits" or "schedules".
- Escalate only when a nudge already failed or the session is far past their p90, especially late at night.
- The justification is one plain sentence a user could read in a log and find fair.
Return only the structured decision."""


def _fallback(f: Features, state: str, allow_escalate: bool) -> dict:
    name_svc = label(f.service)
    if state == "fine":
        return {"action": "quiet", "message": "", "justification": f"{f.minutes:.0f} min on {name_svc} is within your usual range."}
    if state == "drifting":
        return {
            "action": "quiet" if f.prior_nudges_today > 3 else "nudge",
            "message": f"{f.minutes:.0f} min on {name_svc} and climbing. Still what you meant to do?",
            "justification": f"{f.minutes:.0f} min is above your typical {f.p50:.0f}, so a light check-in.",
        }
    # problem
    if allow_escalate:
        return {"action": "escalate", "message": f"They're {f.ratio_p50:.0f}x their usual on {name_svc}.", "justification": f"{f.minutes:.0f} min is past your p90 of {f.p90:.0f}{' late at night' if f.is_late_night else ''}; a nudge already went unheeded."}
    return {"action": "nudge", "message": f"{f.minutes:.0f} min on {name_svc}. This is a lot for you right now. Want to put it down?", "justification": f"{f.minutes:.0f} min is well past your usual {f.p50:.0f}."}


def decide(f: Features, state: str, allow_escalate: bool, friend_hint: str | None) -> tuple[dict, str]:
    """Returns (decision, source). source is 'gemini' or 'fallback'."""
    if not settings.GEMINI_API_KEY:
        return _fallback(f, state, allow_escalate), "fallback"
    try:
        from google import genai
        from google.genai import types

        client = genai.Client(api_key=settings.GEMINI_API_KEY)
        ctx = f.to_dict()
        ctx["service_label"] = label(f.service)
        ctx["state"] = state
        ctx["escalation_allowed"] = allow_escalate
        if friend_hint:
            ctx["suggested_friend"] = friend_hint
        prompt = (
            "Decide what to do about this open session. Context as JSON:\n"
            + json.dumps(ctx, default=str)
            + "\nIf escalation_allowed is false you may not choose escalate."
        )
        resp = client.models.generate_content(
            model=settings.GEMINI_MODEL,
            contents=prompt,
            config=types.GenerateContentConfig(
                system_instruction=SYSTEM,
                response_mime_type="application/json",
                response_schema=DECISION_SCHEMA,
                temperature=0.6,
                max_output_tokens=300,
            ),
        )
        decision = json.loads(resp.text)
        if decision.get("action") == "escalate" and not allow_escalate:
            decision["action"] = "nudge"
        decision.setdefault("message", "")
        decision.setdefault("justification", "")
        return decision, "gemini"
    except Exception as exc:  # any failure -> deterministic behaviour
        log.warning("gemini decide failed, using fallback: %s", exc)
        return _fallback(f, state, allow_escalate), "fallback"
