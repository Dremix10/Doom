# Doom — Devpost submission

**Track:** Work & Productivity
**Challenges:** ElevenLabs (+ any others the team wires before the deadline)

---

## Elevator pitch

An accountability app for screen time with zero settings. Add your friends, and that's it. An AI agent decides when your scrolling has become a problem, and whether to stay quiet, nudge you, or call in the one friend most likely to get through to you.

---

## Inspiration

- Every screen-time app makes *you* do the policy work: set limits, build schedules, pick blocklists.
- Nobody knows their own limits in advance, so the numbers are guesses, and you dismiss the alert you configured yourself.
- The thing that actually stops a doomscroll is a person. Screen Time has never once texted your friend.
- So we moved the decision to an agent and the intervention to your group chat.

## What it does

- **No settings.** No limits, no schedules, no blocklists. You add friends and use your phone.
- **Learns your baseline.** 14 days of your own sessions per app, as p50 and p90 session length. "Too long" is relative to you, not a number we picked.
- **Decides in real time.** Every 30s the agent scores each open session `fine / drifting / problem`, then Claude picks one action: stay quiet, nudge you, or escalate to a friend.
- **Picks the right friend.** Not the closest or the loudest, the one statistically most likely to get through to *you, at this hour*.
- **Friends can pull you out.** They see you're doomscrolling and tap once. Your phone buzzes and the feed physically stops loading.
- **Speaks.** Nudges are delivered in an ElevenLabs voice, because a spoken sentence lands harder than another silent banner.
- **Leaderboards.** Least scrolling wins for social and entertainment; most focus wins for productivity.

## How we built it

**The agent (the actual product)**

- **Baselines:** rolling 14-day p50/p90 of session length per user per app, plus today's total, hour of day, consecutive sessions and prior nudges.
- **Deterministic score first:** a plain function maps those features to `fine / drifting / problem`. The LLM never decides *whether* something is anomalous.
- **Claude Opus 5 (`claude-opus-5`) decides what to do about it** and writes the line you see, returning structured JSON (`action`, `message`, `justification`). We chose Claude over the Gemini track deliberately: it reads a pattern like "14x your usual, nearly midnight, dozens of ignored nudges" and writes something a human would actually say.
- **Guardrails live outside the model, in code:** max one nudge per 20 min, never escalate before a nudge has failed, max 2 escalations a day, never escalate to a friend who is themselves mid-doomscroll, interrupts auto-clear after 10 min. A model refusal or API outage falls through to a deterministic policy, so the loop never breaks.
- **Choosing the friend is a bandit problem:** each friend has a Beta(successes+1, failures+1) posterior per 4-hour bucket. We Thompson-sample and take the argmax, so it exploits whoever works on you while still exploring. Outcomes are scored automatically (did the session end within 5 minutes?) and fed back.

**Getting real screen time off an iPhone with no paid Apple Developer account**

- Apple's Screen Time and Family Controls APIs need a paid account and a signed entitlement. We had neither, so we built two capture paths instead.
- **iOS Shortcuts personal automations:** "When Instagram is opened / closed → POST to `/s/<token>/instagram/open|close`". Exact app-level session boundaries, no App Store, no entitlement.
- **An encrypted-DNS profile** (`.mobileconfig`, DNS-over-HTTPS) pointing the phone at our own AdGuard Home. That gives passive per-app activity, and it is also what makes a pull-out *real*: we flip `blocked_services` for that one phone and the feed stops loading.

**Notifications with no Apple account**

- Installable PWA plus Web Push (VAPID) to Apple's push endpoint, which iOS 16.4+ supports once you Add to Home Screen. Real lock-screen notifications on four iPhones, zero App Store, zero developer account.

**Stack**

- Backend: Python, FastAPI, SQLAlchemy 2.0, SQLite. 36 routes. Agent loop runs in-process.
- App: Expo 57 / Expo Router / React Native 0.86, exported to web as an installable PWA.
- Voice: ElevenLabs text-to-speech.
- Sensor: AdGuard Home (DNS-over-HTTPS) with per-client service blocking.
- Infra: DigitalOcean, nginx, certbot, systemd. Live at https://nudge.aegist.dev.

## Challenges we ran into

- **No paid Apple account** meant no Screen Time API at all. Both capture paths above exist because of that one constraint.
- **Notification spam.** An escalation with no available friend fell back to a plain nudge, which skipped the nudge cooldown and fired on every user with an open session at once — about 50 notifications. Now, if there is nobody to escalate to, the agent holds quiet.
- **A one-row bug that silently killed the agent.** A duplicate insert into the friend-stats table rolled back the *entire* tick, every 5 seconds, for hours. No crash, no alert, just an agent that had quietly stopped thinking.
- **iOS refuses page-initiated audio**, per `<audio>` element. Our voice nudges generated perfectly and played never. Fixed by keeping one element for the session and unlocking it with a silent clip on first tap.
- **Naive timestamps** served without a `Z` were parsed as local time, so the app cheerfully reported it had nudged you "0s ago" three hours later.

## Accomplishments that we're proud of

- Real screen-time capture and real push notifications on stock iPhones with no paid Apple Developer account and nothing installed from an App Store.
- A pull-out that isn't a suggestion. Your friend taps, and the feed stops loading.
- An LLM in the loop that can't spam you, because every hard limit is enforced in code around it.
- It runs on our own phones, in real time, against our own real usage.

## What we learned

- Put the LLM where judgment is needed and nowhere else. Anomaly detection is a function; knowing that 40 minutes at 2am means something different than 40 minutes at lunch is a model.
- Guardrails belong outside the model. Every spam bug we had was a code path around the model, not the model.
- Platform limits are design input. "No paid Apple account" is what produced the Shortcuts and DNS approach, which is more interesting than the entitlement would have been.

## What's next

- Verified humans as accountability partners, so your partner can't be a bot.
- Move the time-series to a purpose-built store; the activity table is already minute-resolution.
- Let the agent learn the *message* that works on you, not just the friend.

## Built With

`python` `fastapi` `sqlalchemy` `sqlite` `typescript` `react-native` `expo` `pwa`
`claude` `anthropic` `elevenlabs` `web-push` `adguard-home` `dns-over-https`
`ios-shortcuts` `nginx` `digitalocean`

## Try it out

- **https://nudge.aegist.dev** — tap "Continue as guest (demo)". You land in a group with the team (marked "hacker") and can pull us out of our own apps. It really does buzz our phones.
- Add to Home Screen for notifications.
