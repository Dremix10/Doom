"""Service categories for the leaderboard.

The DNS sensor reports AdGuard service ids ("tiktok", "youtube", ...). The
leaderboard ranks people within a category, so this is the one place that says
which service belongs where.

Direction matters as much as the grouping: on a leaderboard, rank 1 should be the
place you want to be. For social, entertainment and total screen time that means
the *least* time wins; for productivity it means the *most* does. Each category
carries its own `lower_is_better` so the sort flips with the ranking the user
picked, instead of crowning the least productive person.
"""
from __future__ import annotations

SOCIAL = ["tiktok", "instagram", "twitter", "reddit", "snapchat", "facebook"]
ENTERTAINMENT = ["youtube", "netflix", "twitch", "spotify", "disneyplus"]
PRODUCTIVITY = ["github", "notion", "slack", "gmail", "googledocs", "figma"]

ALL_SERVICES = SOCIAL + ENTERTAINMENT + PRODUCTIVITY

CATEGORIES: dict[str, dict] = {
    "social": {
        "label": "Social media",
        "services": SOCIAL,
        "lower_is_better": True,
        "blurb": "least scrolling wins",
    },
    "productivity": {
        "label": "Productivity",
        "services": PRODUCTIVITY,
        "lower_is_better": False,
        "blurb": "most focus wins",
    },
    "entertainment": {
        "label": "Entertainment",
        "services": ENTERTAINMENT,
        "lower_is_better": True,
        "blurb": "least watching wins",
    },
    "total": {
        "label": "Total screen time",
        "services": ALL_SERVICES,
        "lower_is_better": True,
        "blurb": "least time wins",
    },
}

DEFAULT_CATEGORY = "social"

# Windows the leaderboard can cover, as a number of days back from now. "today"
# is measured from midnight rather than a rolling 24h so it resets the way a
# screen-time day does.
WINDOWS = {"today": 1, "week": 7}
DEFAULT_WINDOW = "today"

# How many days of history the ratio-to-own-baseline is averaged over.
BASELINE_DAYS = 14


def category(name: str | None) -> tuple[str, dict]:
    """Resolve a category id, falling back to the default rather than erroring."""
    key = (name or DEFAULT_CATEGORY).lower()
    if key not in CATEGORIES:
        key = DEFAULT_CATEGORY
    return key, CATEGORIES[key]


def window_days(name: str | None) -> tuple[str, int]:
    key = (name or DEFAULT_WINDOW).lower()
    if key not in WINDOWS:
        key = DEFAULT_WINDOW
    return key, WINDOWS[key]


def service_category(service: str) -> str | None:
    for key, meta in CATEGORIES.items():
        if key != "total" and service in meta["services"]:
            return key
    return None
