"""Settings, all from environment variables (.env at the repo root or in backend/).

Every integration is optional: with nothing configured the backend runs on SQLite
with a deterministic policy, an in-app notification inbox, and no sensor. That is
enough to develop the app and run the simulator.
"""
from __future__ import annotations

import os
from pathlib import Path

from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parents[2]
BACKEND_DIR = ROOT / "backend"
load_dotenv(ROOT / ".env")
load_dotenv(BACKEND_DIR / ".env")


def _bool(value: str | None, default: bool = False) -> bool:
    if value is None or value.strip() == "":
        return default
    return value.strip().lower() in ("1", "true", "yes", "on")


def _float(value: str | None, default: float) -> float:
    try:
        return float(value) if value not in (None, "") else default
    except ValueError:
        return default


class Settings:
    # Placeholder display name. Change APP_NAME in .env once the team picks a name.
    APP_NAME: str = os.getenv("APP_NAME", "Doom")
    DATA_DIR: Path = Path(os.getenv("DATA_DIR", str(BACKEND_DIR / "data")))
    DATABASE_URL: str = os.getenv("DATABASE_URL", "")
    PUBLIC_API_URL: str = os.getenv("PUBLIC_API_URL", "http://localhost:8000").rstrip("/")
    PUBLIC_APP_URL: str = os.getenv("PUBLIC_APP_URL", "http://localhost:8081").rstrip("/")

    # Sensor: AdGuard Home on the Vultr box. Empty ADGUARD_URL disables the poller.
    ADGUARD_URL: str = os.getenv("ADGUARD_URL", "").rstrip("/")
    ADGUARD_USER: str = os.getenv("ADGUARD_USER", "")
    ADGUARD_PASS: str = os.getenv("ADGUARD_PASS", "")
    # DoH endpoint the iPhone profile points at; the per-user ClientID is appended.
    DOH_BASE_URL: str = os.getenv("DOH_BASE_URL", "https://dns.example.com/dns-query").rstrip("/")
    POLL_INTERVAL_S: float = _float(os.getenv("POLL_INTERVAL_S"), 5.0)

    # Agent
    GEMINI_API_KEY: str = os.getenv("GEMINI_API_KEY", "")
    GEMINI_MODEL: str = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")
    AGENT_INTERVAL_S: float = _float(os.getenv("AGENT_INTERVAL_S"), 30.0)
    SESSION_GAP_MIN: float = _float(os.getenv("SESSION_GAP_MIN"), 2.0)
    DEMO_MODE: bool = _bool(os.getenv("DEMO_MODE"), False)
    # In demo mode one real minute of scrolling counts as this many baseline minutes.
    DEMO_TIME_SCALE: float = _float(os.getenv("DEMO_TIME_SCALE"), 20.0)

    # Delivery
    ELEVENLABS_API_KEY: str = os.getenv("ELEVENLABS_API_KEY", "")
    ELEVENLABS_VOICE_ID: str = os.getenv("ELEVENLABS_VOICE_ID", "21m00Tcm4TlvDq8ikWAM")
    TWILIO_ACCOUNT_SID: str = os.getenv("TWILIO_ACCOUNT_SID", "")
    TWILIO_AUTH_TOKEN: str = os.getenv("TWILIO_AUTH_TOKEN", "")
    TWILIO_FROM: str = os.getenv("TWILIO_FROM", "")
    VAPID_PUBLIC_KEY: str = os.getenv("VAPID_PUBLIC_KEY", "")
    VAPID_PRIVATE_KEY: str = os.getenv("VAPID_PRIVATE_KEY", "")
    VAPID_SUBJECT: str = os.getenv("VAPID_SUBJECT", "mailto:team@example.com")

    # Shared secret for the simulator and internal endpoints.
    INTERNAL_TOKEN: str = os.getenv("INTERNAL_TOKEN", "dev-internal-token")

    def __init__(self) -> None:
        self.DATA_DIR.mkdir(parents=True, exist_ok=True)
        (self.DATA_DIR / "media").mkdir(exist_ok=True)
        if not self.DATABASE_URL:
            self.DATABASE_URL = f"sqlite:///{self.DATA_DIR / 'app.db'}"
        if self.DEMO_MODE:
            self.AGENT_INTERVAL_S = min(self.AGENT_INTERVAL_S, 10.0)

    @property
    def is_sqlite(self) -> bool:
        return self.DATABASE_URL.startswith("sqlite")

    @property
    def sensor_enabled(self) -> bool:
        return bool(self.ADGUARD_URL)


settings = Settings()
