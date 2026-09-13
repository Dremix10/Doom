# Doom — handoff

Live: https://nudge.aegist.dev · API `/api` · resolver `https://dns.aegist.dev/dns-query`
Server: `ssh cyprus` (DigitalOcean). Backend `nudge.service`, web served by nginx.

## Deploying (the two paths are different — this bites people)

```bash
# backend
rsync -az --delete --exclude __pycache__ --exclude .venv --exclude data \
  backend/app/ cyprus:nudge/backend/app/
ssh cyprus 'sudo systemctl restart nudge'

# web app  — nginx serves /var/www/nudge, NOT ~/nudge/web
cd app && EXPO_PUBLIC_API_URL="https://nudge.aegist.dev/api" \
  npx expo export --platform web --output-dir dist --clear
python3 scripts/pwa-inject.py
rsync -az --delete dist/ cyprus:/tmp/nudge-web/
ssh cyprus 'sudo rsync -a --delete /tmp/nudge-web/ /var/www/nudge/ \
  && sudo chown -R www-data:www-data /var/www/nudge && rm -rf /tmp/nudge-web'
```

Verify a web deploy actually landed: the bundle hash in `curl -s https://nudge.aegist.dev/ | grep entry-`
must match the file in `app/dist/_expo/static/js/web/`.

## Status

Working and verified live: Claude decisions, Web Push to iPhones, Shortcuts capture,
encrypted-DNS pull-out, leaderboards, guest/judge demo mode, ElevenLabs voice.

Not done: the DNS profile is installed on nobody's phone, so "the feed physically
stops" has never been shown on a device. Three of four teammates have sent zero
Shortcut events and will read 0m on camera.

## Sponsor challenges

Only one track (Work & Productivity), but unlimited challenges. Confirm each
sponsor's exact requirement on their Devpost page before claiming it.

| Challenge | State | Work left |
|---|---|---|
| **ElevenLabs** | claim it | done — voice nudges, fixed and live |
| **GoDaddy** | ~30 min | needs a GoDaddy-registered domain pointed at the droplet. `aegist.dev` is not GoDaddy. Buy one, add an A record to `104.131.94.154`, add an nginx server block + certbot |
| **Persona** | ~1-2 h | `POST /persona/verify` is a stub that always passes. Wire the real hosted flow: your accountability partner has to be a verified human, not a bot. Natural fit for the pitch |
| **Backboard** | ~2 h | store the per-user baselines and what has actually worked on each person as AI memory, and read it back into the Claude prompt |
| **Tiger Data** | ~2-4 h, risky | `activity_minutes` is literally a time-series. Swap SQLite for their Postgres: set `DATABASE_URL`, port the two SQLite-specific spots (string datetimes out of aggregates in `sessions.py` and `demo_data.py`), re-seed. Do NOT start this within 3 hours of the deadline |
| **Gemini** | skip | we chose Claude deliberately and say so in the writeup. `backend/app/agent/gemini.py` still works if anyone changes their mind |
| Vultr / Solana / Presage / Nessie / MathWorks / Notability | skip | no honest fit |
| Lilie Lab | check | Rice students only — confirm eligibility |

Recommended order for one dev: GoDaddy, then Persona, then Backboard. Tiger Data
only if there is real time left.

## Before submitting

1. Record the 3-4 min video (30s intro / 2 min demo / 30s technical / 30s impact).
2. Submit on Devpost — hard deadline **Sun 13 Sept, 9:00 AM CT**.
3. Everyone: delete and re-add Doom to the home screen (iOS caches the old icon).
4. Everyone: check the "Is Closed" Shortcuts automation exists per app, Run
   Immediately, Method POST. Without it sessions run long until a 2h backstop.
5. Install the DNS profile on at least one phone: `https://nudge.aegist.dev/api/setup/<token>`.

## Gotchas

- Demo accounts (`@doom.app`, `simulated=True`) are labelled `· demo`, are never
  acted on by the agent and are never picked as an escalation target. Keep it that way.
- Guests can buzz real phones. That is the point, but it means a judge can
  interrupt your pitch.
- `/guest` numbers judges by counting existing `Judge %` users.
