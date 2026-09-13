# Doom — Devpost submission

**Track:** Work & Productivity · **Challenges:** ElevenLabs

---

## Elevator pitch

Screen-time accountability with zero settings. Add your friends, that's it. An AI agent decides when your scrolling has become a problem, and whether to stay quiet, nudge you, or call in the friend most likely to get through to you.

## Inspiration

- Every screen-time app makes *you* set the limits. Nobody knows their limits in advance.
- You always dismiss the alert you configured yourself.
- What actually stops a doomscroll is a person. Screen Time has never texted your friend.

## What it does

- **No setup.** No limits, no schedules, no blocklists.
- **Learns your baseline.** 14 days of your own sessions per app. "Too long" is relative to you.
- **Decides every 30 seconds.** Stay quiet, nudge you, or escalate to a friend.
- **Picks the right friend.** The one most likely to get through to you *at this hour*.
- **Friends pull you out.** One tap. Your phone buzzes and the feed stops loading.
- **Speaks.** Nudges play in an ElevenLabs voice, not another silent banner.
- **Leaderboards.** Least scrolling wins. Most focus wins.

## How we built it

**The agent**

- A plain function scores each open session `fine / drifting / problem` from your p50/p90 session length, time of day, and today's total. The model never decides *whether* something is anomalous.
- **Claude Opus 5** decides what to do about it and writes the line you read, as structured JSON.
- **Guardrails are in code, not the prompt:** one nudge per 20 min, never escalate before a nudge fails, 2 escalations a day max, never escalate to a friend who is themselves doomscrolling. On any model failure it falls back to a deterministic policy.
- **Choosing the friend is a bandit.** Each friend has a Beta posterior per 4-hour bucket; we Thompson-sample. Outcomes score themselves: did the session end within 5 minutes?

**Getting screen time off an iPhone with no paid Apple account**

- Screen Time APIs need a paid developer account. We had none, so we built two capture paths:
- **iOS Shortcuts automations** — "when Instagram opens/closes, POST here". Exact session boundaries, no App Store.
- **An encrypted-DNS profile** pointing the phone at our own AdGuard Home. That's also what makes a pull-out real: we block that one service for that one phone and the feed stops loading.

**Notifications with no Apple account**

- An installable PWA plus Web Push. Real lock-screen notifications on four iPhones, no App Store, no developer account.

**Stack:** Python, FastAPI, SQLAlchemy, SQLite · Expo / React Native exported to web · ElevenLabs · AdGuard Home (DNS-over-HTTPS) · nginx + DigitalOcean.

## Challenges we ran into

- **No paid Apple account.** Both capture paths above exist because of that one constraint.
- **We spammed ourselves with ~50 notifications.** An escalation with no available friend fell back to a nudge and skipped the cooldown. Now it holds quiet instead.
- **One duplicate row silently killed the agent.** A failed insert rolled back the whole tick, every 5 seconds, for hours. No crash, no alert, just an agent that had stopped thinking.
- **iOS refuses to play audio a page starts.** Our voice nudges generated perfectly and played never.

## Accomplishments

- Real screen-time capture and real push notifications on stock iPhones, with no paid Apple account and nothing from an App Store.
- A pull-out that isn't a suggestion — the feed actually stops.
- An LLM in the loop that can't spam you, because every hard limit is enforced around it.

## What we learned

- Put the model where judgment is needed and nowhere else. Detecting an anomaly is a function. Knowing that 40 minutes at 2am means something different than 40 minutes at lunch is a model.
- Every spam bug we had was in our code around the model, not the model.
- Platform limits are design input. "No paid Apple account" produced a better idea than the entitlement would have.

## What's next

- Verified humans as partners, so your accountability partner can't be a bot.
- A real time-series database for the minute-level data.
- Learn the *message* that works on you, not just the friend.

## Built With

`python` `fastapi` `sqlalchemy` `sqlite` `typescript` `react-native` `expo` `pwa`
`claude` `anthropic` `elevenlabs` `web-push` `adguard-home` `dns-over-https`
`ios-shortcuts` `nginx` `digitalocean`

## Try it out

**https://nudge.aegist.dev** — tap "Continue as guest (demo)". You land in a group with the team (marked "hacker") and can pull us out of our own apps. It really does buzz our phones. Add to Home Screen for notifications.
