# Hosting Nudge on DigitalOcean

You need two things online: the **API** (this backend) and the **web app**
(the built `app/dist`). Simplest split: API on DigitalOcean, web app on any
static host. All your devices (Macs, iPads, iPhones) then hit one public URL,
so it works off your Wi-Fi and updates in real time (the app polls every ~4s).

## Option A — App Platform (managed, easiest)

1. Push to GitHub (done: `Dremix10/Doom`).
2. `doctl apps create --spec infra/digitalocean/app.yaml`, or in the DO UI:
   Apps → Create → pick the repo → it detects `backend/Dockerfile`.
3. Add your keys as env vars / secrets in the dashboard (see the list below).
4. You get a URL like `https://nudge-api-xxxx.ondigitalocean.app`. That's your
   `PUBLIC_API_URL`.

## Option B — a Droplet (full control)

1. Create an Ubuntu droplet, install Docker.
2. `cd backend && docker build -t nudge-api . && docker run -d -p 80:8000 --env-file .env nudge-api`
3. Point a domain at the droplet; put Caddy in front for TLS (see infra/adguard/Caddyfile
   for the pattern). HTTPS matters: iOS Web Push and "Add to Home Screen" want it.

## The web app

Build it against the deployed API and host the static files:

```
cd app
EXPO_PUBLIC_API_URL=https://YOUR-API-URL npx expo export --platform web
python3 scripts/pwa-inject.py     # re-add the home-screen app tags
```

Then host `app/dist/` on DO App Platform (Static Site), Netlify, Vercel, or the
same droplet behind Caddy. Open that URL in Safari → Share → Add to Home Screen.

## Database

- Quick demo: SQLite inside the container (default). Note it resets on redeploy.
- Real / Tiger Data challenge: set `DATABASE_URL` to a Tiger Cloud (Timescale)
  or DO Managed Postgres instance. SQLAlchemy handles the rest; the schema is
  created on boot. (Timescale hypertable + continuous aggregates are a follow-up.)

## Env vars the API reads

`APP_NAME, PUBLIC_API_URL, DATABASE_URL, GEMINI_API_KEY, ELEVENLABS_API_KEY,
ADGUARD_URL/USER/PASS, DOH_BASE_URL, TWILIO_ACCOUNT_SID/AUTH_TOKEN/FROM,
VAPID_PUBLIC_KEY/PRIVATE_KEY/SUBJECT, DEMO_MODE`. See `backend/.env.example`.
Everything is optional; unset integrations degrade gracefully.

## Notifications (Web Push) — no Apple developer account

Once the web app is on HTTPS (App Platform gives you that automatically), push
works on installed PWAs, iOS 16.4+ (Add to Home Screen, open it, then Settings →
Turn on notifications), plus Android and desktop. Set three secrets on the API:

```
python -m app.tools.vapid   # prints VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY
```

Add `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, and `VAPID_SUBJECT=mailto:you@domain`
as env vars on the `api` service. The client reads the public key from
`/push/config` at runtime; nothing to rebuild.
