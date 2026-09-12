"""Claude decision policy (Anthropic API).

The team chose Claude for sharper, more human pattern analysis, so when
ANTHROPIC_API_KEY is set this is the agent's brain. It reuses the exact same
structured-decision contract, policy brief, and deterministic fallback as the
Gemini path, so a bad key, an outage, or a safety refusal never breaks the loop.
"""
from __future__ import annotations

import json
import logging

from ..config import settings
from ..services import label
from .features import Features
from .gemini import SYSTEM, _fallback  # same policy brief + deterministic fallback

log = logging.getLogger(__name__)


def _extract_json(text: str) -> str:
    """Claude is asked for JSON only; be defensive if it adds surrounding prose."""
    start = text.find("{")
    end = text.rfind("}")
    return text[start : end + 1] if start != -1 and end != -1 else text


def decide(f: Features, state: str, allow_escalate: bool, friend_hint: str | None) -> tuple[dict, str]:
    """Return (decision, source). source is 'claude' or 'fallback'."""
    if not settings.ANTHROPIC_API_KEY:
        return _fallback(f, state, allow_escalate), "fallback"
    try:
        import anthropic

        client = anthropic.Anthropic(api_key=settings.ANTHROPIC_API_KEY)
        ctx = f.to_dict()
        ctx["service_label"] = label(f.service)
        ctx["state"] = state
        ctx["escalation_allowed"] = allow_escalate
        if friend_hint:
            ctx["suggested_friend"] = friend_hint
        prompt = (
            "Decide what to do about this open session. The context is one person's "
            "live usage measured against their OWN 14-day baseline.\n\nContext as JSON:\n"
            + json.dumps(ctx, default=str)
            + '\n\nRespond with ONLY a JSON object, nothing else: '
            '{"action": "quiet|nudge|escalate", '
            '"message": "the line to show them, empty string if quiet", '
            '"justification": "one plain sentence for the decision log"}. '
            "If escalation_allowed is false you may not choose escalate."
        )
        resp = client.messages.create(
            model=settings.ANTHROPIC_MODEL,
            max_tokens=4000,
            system=SYSTEM,
            output_config={"effort": "medium"},
            messages=[{"role": "user", "content": prompt}],
        )
        if getattr(resp, "stop_reason", None) == "refusal":
            log.warning("claude refused; using fallback")
            return _fallback(f, state, allow_escalate), "fallback"
        text = "".join(b.text for b in resp.content if getattr(b, "type", None) == "text")
        decision = json.loads(_extract_json(text))
        if decision.get("action") == "escalate" and not allow_escalate:
            decision["action"] = "nudge"
        decision.setdefault("message", "")
        decision.setdefault("justification", "")
        if decision.get("action") not in ("quiet", "nudge", "escalate", "interrupt"):
            return _fallback(f, state, allow_escalate), "fallback"
        return decision, "claude"
    except Exception as exc:  # any failure -> deterministic behaviour
        log.warning("claude decide failed, using fallback: %s", exc)
        return _fallback(f, state, allow_escalate), "fallback"
