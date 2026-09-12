# Demo runbook (2 minutes)

Goal: show the agent doing the policy work, then a friend pulling someone out,
with real notifications and (if the sensor is live) the feed actually stopping.

## Before judging
- `make demo` (API in demo mode) on the laptop that will drive.
- `make seed` once, so all four of you have 14 days of baseline history.
- Open the app on two phones: **A** (the scroller) and **B** (the friend).
  Both add each other (Setup tab shows the invite code).
- If the DNS sensor is live: A's phone has the profile installed, Private Relay
  and VPN off. If not, drive A's scroll with `make scroll USER=<A> SVC=tiktok MIN=2`.

## The 2 minutes
1. **Setup (15s).** "Screen-time apps make *you* set limits and blocklists. Nobody
   does. Nudge has zero settings. You add friends, and an agent does the policy."
2. **Drift (30s).** A scrolls TikTok. On B's Friends tab, A goes green -> amber
   -> red ("doomscrolling · 3× usual"), live. On A's You tab the agent log shows
   it *staying quiet* at 2× ("within range") then **nudging** at 3× — with a
   Gemini line, read aloud by ElevenLabs.
3. **Escalate (30s).** A keeps scrolling. The agent **asks the friend it ranks
   highest**, and shows why: "you get through to A at this hour more than anyone."
   B gets the alert.
4. **Pull out (25s).** B taps **Pull out**. A gets it, and (sensor live) TikTok
   stops loading for 10 minutes. The session ends; the outcome is logged and B's
   success score for this hour ticks up — it learns.
5. **Real data (20s).** Show the weekend's actual leaderboard/among the four of you.

## If something breaks
- Sensor flaky -> `make scroll` drives the same arc from the laptop.
- Push flaky -> notifications still appear in-app (the You tab polls) and Twilio
  SMS is the backup channel.
- Gemini down -> the agent falls back to a deterministic policy; the demo still runs.
