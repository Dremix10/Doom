"""ElevenLabs text-to-speech for agent nudges. No-ops without a key (returns None)."""
from __future__ import annotations

import logging
from pathlib import Path

import httpx

from ..config import settings
from ..db import utcnow
from ..models import new_id

log = logging.getLogger(__name__)


def synthesize(text: str) -> str | None:
    """Render text to an mp3 under data/media and return its public URL path, or None."""
    if not settings.ELEVENLABS_API_KEY or not text.strip():
        return None
    try:
        url = f"https://api.elevenlabs.io/v1/text-to-speech/{settings.ELEVENLABS_VOICE_ID}"
        r = httpx.post(
            url,
            headers={"xi-api-key": settings.ELEVENLABS_API_KEY, "accept": "audio/mpeg"},
            json={"text": text, "model_id": "eleven_turbo_v2_5",
                  "voice_settings": {"stability": 0.4, "similarity_boost": 0.7}},
            timeout=20.0,
        )
        r.raise_for_status()
        name = f"tts_{utcnow():%Y%m%d}_{new_id()}.mp3"
        out: Path = settings.DATA_DIR / "media" / name
        out.write_bytes(r.content)
        return f"/media/{name}"
    except Exception as exc:
        log.warning("elevenlabs failed: %s", exc)
        return None
