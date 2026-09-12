# Spec (working title: TBD)

HackRice 16, Work & Productivity track. Team of 4, four iPhones, no paid Apple developer account. Devpost deadline **Sunday Sept 13, 9:00 AM CT**.

## One paragraph

An accountability app for screen time with zero settings. Add your friends, and that's it. An agent watches your usage against your own baseline, decides when a session has become a problem, and figures out whether to stay quiet, nudge you, or ask the one friend most likely to get through to you right now. Friends see when you're doomscrolling and can pull you out. No schedules, no limits, no blocklists. The AI does the policy work every other app pushes onto you.

## What "zero settings" means in practice

- No schedules, limits, allowlists or blocklists anywhere in the UI. The only user actions are: sign in, install the one-tap sensor profile, add friends, respond to a nudge, pull a friend out.
- What counts as "distracting" is inferred, not configured: a service catalogue (TikTok, Instagram, X, YouTube, Reddit, Snapchat, ...) plus the user's own behaviour (long continuous sessions).
- Quiet hours are inferred from the baseline, not set.
- The only knob in the codebase is a hidden **demo mode** that compresses time so a live 2-minute demo can trigger the agent.

## Capture layer: the phone's DNS traffic is the sensor

Apple does not let apps read Screen Time, and the workaround needs a paid developer account the team doesn't have. So we don't run anything on the phone. Instead:

1. Each user installs a **one-tap encrypted-DNS profile** (`.mobileconfig`, `com.apple.dnsSettings.managed`, DNS-over-HTTPS). No developer account, no app store, no MDM. It applies to every app on Wi-Fi and cellular.
2. The profile points at **our AdGuard Home resolver** on a Vultr VM with a TLS cert on our GoDaddy domain. The DoH URL carries a per-user ClientID: `https://dns.<domain>/dns-query/<clientid>`.
3. While you scroll TikTok or Instagram the app resolves a stream of CDN hostnames. A Python worker polls AdGuard's query log every 5 s, maps ClientID to user and hostname to service, and turns query density into **minute-level activity per service**. Raw hostnames are discarded after classification; only `user, service, minute, active` is stored.
4. **Pull out is real, not a notification.** When a friend pulls you out, or the agent escalates, we set that user's AdGuard per-client `blocked_services` to the offending service for 10 minutes. The feed stops loading. The block clears itself.

| Source | Method | Accuracy | Status |
|---|---|---|---|
| iPhone (all apps) | DoH profile → AdGuard query log → session inference | Real time (5 s), minute granularity, per service not per app | **Primary** |
| iPhone precision add-on | Shortcuts automation per app: "When TikTok is opened, run immediately → POST to API" | Exact open events | Optional, needs one automation per app |
| Laptop (Chrome) | Extension tracking active tab domain | Exact | Optional, good live-demo source |

Known constraints to test first thing Saturday: iCloud Private Relay and VPNs must be off on the demo phones; DNS caching can make activity look sparse, so the activity detector uses "any query to the service in the last 60 s" rather than query counts, and AdGuard's TTL settings will be tuned if needed.

## The agent (the product)

Runs server-side, evaluated every 30 s per active session.

**Baseline.** Per user and per service, rolling 14 days: distribution of session lengths, and daily totals bucketed by hour of day and weekday. Stored as continuous aggregates on Timescale. Cold start uses a population prior for the first two days.

**Session state.** Active minutes in the same service merged when the gap is under 2 minutes. Features per tick: current session length, today's total, ratio to personal p50 and p90, hour of day, consecutive sessions, minutes since last intervention, how the user responded to past interventions.

**Problem score.** Deterministic: session-length percentile against the personal baseline, boosted for late night and for a day already far above baseline. Produces `fine / drifting / problem`.

**Decision.** Gemini receives the features, the score, the intervention history and the friend table, and returns a structured decision: `quiet | nudge | escalate(friend_id) | interrupt` plus the message text and a one-line justification. Hard guardrails outside the LLM: at most one nudge per 20 minutes, at most two escalations per day, never escalate before nudging once, never escalate to a friend who is themselves in a problem session, interrupts (DNS blocks) last at most 10 minutes.

**Friend choice.** Thompson sampling over friends with a Beta(successes+1, failures+1) posterior per friend and time-of-day bucket, filtered by availability (app open in the last 15 min). Gemini breaks ties with relationship context. This is the "most likely to get through to you right now" claim, and it learns.

**Outcome.** An intervention succeeds if the session ends within 5 minutes. Outcomes update the friend posteriors and the user's own nudge responsiveness. The justification log is visible in the app.

## App and delivery

- The app is an **Expo project built for web and installed to the iPhone home screen as a PWA**. iOS 16.4+ supports Web Push for home-screen PWAs with no Apple account, so nudges arrive as real notifications. The same code runs in Expo Go for development.
- **SMS via Twilio is the fallback channel** for the demo, so a nudge still lands if Web Push misbehaves on stage.
- Friends list shows each person's live state: fine, drifting, doomscrolling (with minutes and "3x usual").
- **Pull out** sends a text line and optionally a 5-second real voice note recorded in the PWA, and applies the 10-minute DNS interrupt.
- Friends are verified humans (Persona hosted flow at signup), so an account is one person and pull-outs can't be spoofed.

## Two-minute live demo

1. Phone A opens TikTok and scrolls. Phone B (friend) shows A drifting, then doomscrolling, minutes climbing, live.
2. The agent's log on A: stayed quiet at 2x baseline, nudged at 3x with a Gemini-written line, voiced by ElevenLabs.
3. A keeps scrolling. The agent escalates to the friend it ranks highest and says why: "you're the one who gets through at this hour."
4. B taps Pull out and records a 3-second voice note. A gets the note, and TikTok stops loading. Judges can watch the feed die. Outcome logged, B's score for this hour goes up.
5. Close on the weekend's real data: the team's own baselines and which interventions worked.

Demo mode compresses the baseline multipliers so step 2 happens within ~60 s of scrolling.

## Sponsor challenges this earns

| Challenge | How it's used |
|---|---|
| Gemini API | Decision policy, message composition, classifying unknown hostnames |
| ElevenLabs | Voice for agent nudges |
| Persona | Verified-human friends, one person one account |
| Tiger Data | Activity hypertable, continuous aggregates for baselines |
| Vultr | Hosts AdGuard Home, the API and the agent loop |
| GoDaddy | The domain the DoH endpoint and PWA live on (required for the TLS cert) |
| Backboard (optional) | Per-user memory of what works |

## Team split (4)

1. **Sensor:** Vultr VM, AdGuard Home with TLS, profile generator with per-user ClientIDs, query-log poller, hostname→service catalogue, activity/session inference, per-client block/unblock. Validate on a real phone before anything else.
2. **Agent and data:** Timescale schema, baselines, problem score, Gemini decision loop, Thompson sampling, outcome tracking, simulator.
3. **App UI:** Expo web PWA: friends list with live states, agent log, nudge and pull-out flows, voice note recording, Web Push registration, Persona signup.
4. **Glue and pitch:** ElevenLabs, Twilio fallback, domain and DNS records, deploy, Devpost page, video, demo rehearsal.

## Order of work

1. Sensor proof: one phone, one profile, a hostname stream visible in the query log, then TikTok blocked and unblocked from a script. This is the risk; do it first.
2. Simulator: 14 days of realistic activity for 4 users so the agent and UI can be built without waiting for real data.
3. Agent loop end to end on simulated data (activity in, decision out, notification sent).
4. Everyone installs the profile Saturday morning so Sunday has real baselines.
5. Friend UI and pull-out flow, then voice, Persona, deploy, video.

## Things only the team can do (accounts)

- GoDaddy domain (also a challenge entry), pointed at the Vultr VM.
- Vultr VM (Ubuntu, 1-2 vCPU is plenty), ports 443 and 853 open.
- API keys: Gemini, ElevenLabs, Twilio (trial is fine, verify the four numbers), Persona sandbox, Tiger Cloud instance.

## Credits

Every third-party package and any adapted code gets listed here with a link, per the HackRice rules ("clearly credit this work and inform your judge").

- AdGuard Home (GPL-3.0) runs unmodified as the DNS resolver; we talk to it over its HTTP API.
