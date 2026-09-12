"""Hostname -> service classification.

Domain rules come from AdGuard's public blocked-services catalogue
(https://adguardteam.github.io/HostlistsRegistry/assets/services.json, bundled as
services_catalog.json), plus a few CDN hostnames the feed apps hit while scrolling.
The same service ids are what AdGuard Home's per-client `blocked_services` accepts,
so classification and enforcement share one vocabulary.
"""
from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path

CATALOG_PATH = Path(__file__).with_name("services_catalog.json")

# Services the agent treats as feeds worth watching. Everything else is ignored.
DISTRACTING: dict[str, str] = {
    "tiktok": "TikTok",
    "instagram": "Instagram",
    "twitter": "X",
    "youtube": "YouTube",
    "reddit": "Reddit",
    "snapchat": "Snapchat",
    "facebook": "Facebook",
    "twitch": "Twitch",
    "pinterest": "Pinterest",
    "tumblr": "Tumblr",
    "9gag": "9GAG",
    "netflix": "Netflix",
}

# Hostnames seen while scrolling that the catalogue misses or lists under wildcards.
SUPPLEMENT: dict[str, str] = {
    "tiktokcdn.com": "tiktok",
    "tiktokcdn-us.com": "tiktok",
    "tiktokv.com": "tiktok",
    "tiktokv.us": "tiktok",
    "tiktok.com": "tiktok",
    "musical.ly": "tiktok",
    "byteoversea.com": "tiktok",
    "ibyteimg.com": "tiktok",
    "ibytedtos.com": "tiktok",
    "ttwstatic.com": "tiktok",
    "cdninstagram.com": "instagram",
    "instagram.com": "instagram",
    "ig.me": "instagram",
    "twitter.com": "twitter",
    "x.com": "twitter",
    "twimg.com": "twitter",
    "t.co": "twitter",
    "youtube.com": "youtube",
    "googlevideo.com": "youtube",
    "ytimg.com": "youtube",
    "youtu.be": "youtube",
    "reddit.com": "reddit",
    "redd.it": "reddit",
    "redditmedia.com": "reddit",
    "redditstatic.com": "reddit",
    "snapchat.com": "snapchat",
    "sc-cdn.net": "snapchat",
}


def label(service: str) -> str:
    return DISTRACTING.get(service, service.title())


def _rule_to_suffix(rule: str) -> str | None:
    rule = rule.strip()
    if not rule or rule.startswith("!") or rule.startswith("@@"):
        return None
    if rule.startswith("||"):
        rule = rule[2:]
    elif rule.startswith("|"):
        rule = rule[1:]
    rule = rule.rstrip("^").rstrip("|")
    if "*" in rule or "/" in rule or "$" in rule or rule.startswith("http"):
        return None
    return rule.lower().strip(".") or None


@lru_cache(maxsize=1)
def suffix_table() -> dict[str, str]:
    table: dict[str, str] = {}
    try:
        data = json.loads(CATALOG_PATH.read_text(encoding="utf-8"))
    except FileNotFoundError:
        data = {"blocked_services": []}
    for svc in data.get("blocked_services", []):
        sid = svc.get("id")
        if sid not in DISTRACTING:
            continue
        for rule in svc.get("rules", []):
            suffix = _rule_to_suffix(rule)
            if suffix:
                table.setdefault(suffix, sid)
    table.update(SUPPLEMENT)
    return table


def classify(hostname: str) -> str | None:
    """Return the service id for a hostname, or None if it is not a watched service."""
    host = hostname.lower().strip(".")
    table = suffix_table()
    parts = host.split(".")
    for i in range(len(parts) - 1):
        candidate = ".".join(parts[i:])
        sid = table.get(candidate)
        if sid:
            return sid
    return None
