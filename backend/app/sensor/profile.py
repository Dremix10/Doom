"""Generate the one-tap iPhone configuration profile.

A `com.apple.dnsSettings.managed` payload pointing every app's DNS at our
DNS-over-HTTPS endpoint, with the user's ClientID in the URL path. Installs from
Safari with no developer account or MDM. Applies to Wi-Fi and cellular.
"""
from __future__ import annotations

import plistlib
import uuid

from ..config import settings
from ..models import User


def doh_url_for(user: User) -> str:
    return f"{settings.DOH_BASE_URL}/{user.client_id}"


def build_mobileconfig(user: User) -> bytes:
    app = settings.APP_NAME
    payload_uuid = str(uuid.uuid4()).upper()
    profile_uuid = str(uuid.uuid4()).upper()
    dns_payload = {
        "PayloadType": "com.apple.dnsSettings.managed",
        "PayloadVersion": 1,
        "PayloadIdentifier": f"com.hackrice16.{app.lower()}.dns.{user.client_id}",
        "PayloadUUID": payload_uuid,
        "PayloadDisplayName": f"{app} sensor",
        "PayloadDescription": f"Routes DNS through {app} so it can notice when you're doomscrolling.",
        "DNSSettings": {
            "DNSProtocol": "HTTPS",
            "ServerURL": doh_url_for(user),
        },
        "ProhibitDisablement": False,
    }
    profile = {
        "PayloadType": "Configuration",
        "PayloadVersion": 1,
        "PayloadIdentifier": f"com.hackrice16.{app.lower()}.{user.client_id}",
        "PayloadUUID": profile_uuid,
        "PayloadDisplayName": f"{app} for {user.name}",
        "PayloadDescription": (
            f"{app} watches your screen time against your own baseline and lets your friends pull you out. "
            "No schedules, no limits, no blocklists. Remove this profile any time in Settings."
        ),
        "PayloadOrganization": app,
        "PayloadRemovalDisallowed": False,
        "PayloadContent": [dns_payload],
    }
    return plistlib.dumps(profile, fmt=plistlib.FMT_XML)


SETUP_HTML = """<!doctype html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>{app} setup</title>
<style>
body{{font-family:-apple-system,system-ui,sans-serif;margin:0;padding:24px;background:#0b0b0f;color:#f2f2f7}}
h1{{font-size:28px;margin:0 0 8px}} p{{line-height:1.5;color:#c7c7cc}} ol{{padding-left:20px;color:#c7c7cc;line-height:1.7}}
a.btn{{display:block;text-align:center;background:#5e5ce6;color:#fff;text-decoration:none;padding:16px;border-radius:14px;font-size:18px;font-weight:600;margin:24px 0}}
code{{background:#1c1c1e;padding:2px 6px;border-radius:6px}}
</style></head><body>
<h1>Hi {name}.</h1>
<p>One tap installs the sensor. It routes your phone's DNS through {app} so we can tell when a scroll has gone on too long. Nothing runs on your phone and you can remove it in Settings any time.</p>
<a class="btn" href="{profile_url}">Install the {app} profile</a>
<ol>
<li>Tap the button, then <b>Allow</b> the download.</li>
<li>Open <b>Settings</b>. Tap <b>Profile Downloaded</b> at the top.</li>
<li>Tap <b>Install</b>, enter your passcode, tap <b>Install</b> again.</li>
<li>Turn off <b>iCloud Private Relay</b> (Settings &rarr; your name &rarr; iCloud &rarr; Private Relay) and any VPN, or they bypass the sensor.</li>
</ol>
<p>Your sensor id is <code>{client_id}</code>. Invite code for friends: <code>{invite_code}</code>.</p>
</body></html>
"""


def setup_page(user: User, profile_url: str) -> str:
    return SETUP_HTML.format(
        app=settings.APP_NAME,
        name=user.name,
        profile_url=profile_url,
        client_id=user.client_id,
        invite_code=user.invite_code,
    )
