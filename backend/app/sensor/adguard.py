"""Thin client for the AdGuard Home HTTP API.

Two jobs: read the query log (the sensor) and set per-client blocked services
(the enforcement behind "pull out"). AdGuard identifies each phone by the
ClientID in its DoH URL, which is the user's `client_id`.
"""
from __future__ import annotations

import logging
from datetime import datetime
from typing import Any

import httpx

from ..config import settings

log = logging.getLogger(__name__)


class AdGuard:
    def __init__(self, base_url: str | None = None, user: str | None = None, password: str | None = None):
        self.base_url = (base_url if base_url is not None else settings.ADGUARD_URL).rstrip("/")
        auth = (user or settings.ADGUARD_USER, password or settings.ADGUARD_PASS)
        self._client = httpx.Client(base_url=self.base_url + "/control", auth=auth if auth[0] else None, timeout=10.0)

    @property
    def enabled(self) -> bool:
        return bool(self.base_url)

    # ---- sensor -------------------------------------------------------------

    def fetch_recent(self, limit: int = 500) -> list[dict[str, Any]]:
        """Newest-first query log items. Each has time, client_id, question.name, reason."""
        r = self._client.get("/querylog", params={"limit": limit})
        r.raise_for_status()
        return r.json().get("data", [])

    @staticmethod
    def parse_time(value: str) -> datetime:
        # e.g. 2026-09-12T01:02:41.123456-05:00 -> naive UTC
        dt = datetime.fromisoformat(value)
        if dt.tzinfo is not None:
            dt = (dt - dt.utcoffset()).replace(tzinfo=None)
        return dt

    # ---- clients ------------------------------------------------------------

    def find_client(self, client_id: str) -> dict[str, Any] | None:
        r = self._client.post("/clients/search", json={"clients": [{"id": client_id}]})
        if r.status_code == 404:
            return None
        r.raise_for_status()
        for entry in r.json() or []:
            for _key, info in (entry or {}).items():
                if info and client_id in (info.get("ids") or []):
                    return info
        return None

    def ensure_client(self, client_id: str, name: str) -> dict[str, Any]:
        existing = self.find_client(client_id)
        if existing:
            return existing
        body = {
            "name": name,
            "ids": [client_id],
            "use_global_settings": True,
            "filtering_enabled": True,
            "parental_enabled": False,
            "safebrowsing_enabled": False,
            "use_global_blocked_services": True,
            "blocked_services": [],
            "upstreams": [],
            "tags": [],
            "ignore_querylog": False,
            "ignore_statistics": False,
        }
        r = self._client.post("/clients/add", json=body)
        r.raise_for_status()
        return body

    def set_blocked_services(self, client_id: str, name: str, services: list[str]) -> None:
        """Block (or unblock with an empty list) services for one phone, effective immediately."""
        current = self.ensure_client(client_id, name)
        data = dict(current)
        data["name"] = current.get("name", name)
        data["ids"] = current.get("ids", [client_id])
        data["use_global_blocked_services"] = len(services) == 0
        data["blocked_services"] = services
        data.pop("blocked_services_schedule", None)
        r = self._client.post("/clients/update", json={"name": data["name"], "data": data})
        r.raise_for_status()
        log.info("adguard: client %s blocked_services=%s", client_id, services)

    def all_services(self) -> list[str]:
        r = self._client.get("/blocked_services/all")
        r.raise_for_status()
        return [s["id"] for s in r.json().get("blocked_services", [])]


_singleton: AdGuard | None = None


def adguard() -> AdGuard:
    global _singleton
    if _singleton is None:
        _singleton = AdGuard()
    return _singleton
