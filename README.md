# Doom

**Screen-time accountability with zero settings.** Add your friends, and that's it.
An agent watches your usage against *your own* baseline, decides when a session has
become a problem, and figures out whether to stay quiet, nudge you, or ask the one
friend most likely to get through to you right now. Friends see when you're
doomscrolling and can pull you out. No schedules, no limits, no blocklists — the AI
does the policy work every other app pushes onto you.

HackRice 16 · Work & Productivity track.

## Why this is different

Every screen-time app makes *you* configure limits, schedules and blocklists, then
you disable them the moment they're inconvenient. Doom has none of that. It learns
what's normal for you and only acts when a session is genuinely unusual — and the
last line of defense is a human friend, not a timer you'll ignore.

## How it works

```
 iPhone (DNS-over-HTTPS profile)                 Backend (FastAPI)
   every app's DNS  ─────────────►  AdGuard Home ──► poller ──► activity minutes
                                        ▲                           │
   "pull out" blocks a service  ◄───────┘                          ▼
                                                     sessions ──► baselines (per user)
                                                                    │
                                                     problem score (deterministic)
                                                                    │
                                                     Gemini decision: quiet / nudge /
                                                       escalate(friend) + why
                                                                    │
                                     Thompson sampling picks the friend most likely
                                       to get through now (learns from outcomes)
                                                                    │
                                      ElevenLabs voice · Web Push · Twilio SMS
```

- **No app on the phone.** Apple blocks Screen Time access without a paid developer
  account, so instead each phone installs a one-tap encrypted-DNS profile. We infer
  usage from the DNS stream and enforce "pull out" by flipping AdGuard's per-client
  blocked services. Works on any iPhone, no App Store, no MDM. See `infra/adguard`.
- **The agent is the product.** Deterministic guardrails wrap an LLM decision:
  never nag (one nudge per 20 min), never escalate before nudging, cap escalations,
  never ask a friend who's themselves doomscrolling. Every decision — including
  staying quiet — is logged and shown to the user, so the policy is legible.
- **It learns who reaches you.** Each friend has a Beta posterior per time-of-day
  bucket; we Thompson-sample to pick who to ask, and update on whether it worked.

## Sponsor challenges

| Challenge | Where |
|---|---|
| Gemini API | `backend/app/agent/gemini.py` — the decision policy + message writing |
| ElevenLabs | `backend/app/delivery/voice.py` — spoken nudges |
| Persona | verified-human friends (`/persona/verify`, Setup screen) |
| Tiger Data | activity hypertable + baselines (`DATABASE_URL` -> Tiger Cloud) |
| Vultr | hosts AdGuard Home + the API (`infra/`) |
| GoDaddy | the domain the DoH endpoint + PWA live on |

## Run it

```bash
make install          # backend venv + app deps  (needs python3.12 and node)
make seed             # 21 days of history for 4 users (Demetris, Maria, Andreas, Sofia)
make demo             # API in demo mode at :8000
# new terminal:
make scroll USER=Demetris SVC=tiktok MIN=2   # simulate a doomscroll; watch the agent react
make app              # Expo app (press w for web, or scan for a phone)
```

With nothing configured the backend runs on SQLite with a deterministic policy and
an in-app inbox — enough to build and demo without any keys. Add keys in
`backend/.env` (see `backend/.env.example`) to light up Gemini, ElevenLabs, the DNS
sensor, Tiger Cloud, push and SMS.

- Live demo script: `docs/DEMO.md`
- Full spec: `docs/SPEC.md`
- The DNS sensor (Vultr): `infra/adguard/README.md`

## Layout

```
backend/   FastAPI API, the agent, the DNS sensor, and the simulator
  app/agent/    baseline, features, problem score, Gemini, friend selection, policy, loop
  app/sensor/   AdGuard client, query-log poller, iPhone profile generator
  app/delivery/ ElevenLabs voice, push/SMS/in-app notifications
  simulator/    seed.py (history) and live.py (drive a demo scroll)
app/       Expo (React Native) app — runs as an iPhone home-screen PWA
infra/     AdGuard Home + Caddy on Vultr; Vultr provisioning script
docs/      SPEC.md, DEMO.md
```

## Credits (per HackRice rules)

Built at HackRice 16. Third-party components, all used via their public APIs/SDKs:

- **AdGuard Home** (GPL-3.0) — DNS resolver + filtering, run unmodified via its HTTP API.
- **AdGuard blocked-services catalogue** — hostname→service rules (`services_catalog.json`).
- **Caddy** — automatic TLS for the DoH endpoint.
- FastAPI, SQLAlchemy, Expo/React Native, and the Gemini, ElevenLabs, Persona,
  Twilio and pywebpush SDKs.
- Apple `com.apple.dnsSettings.managed` configuration-profile format for the sensor.
