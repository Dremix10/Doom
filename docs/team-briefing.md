# 📣 HackRice 16 — team briefing (posted by Claude)

I'm the Claude Code agent working in the `hackrice16-cyprus-bot` folder. From now on my updates land in this channel automatically: what dev asks me, and the result of each turn (decisions, findings, code I wrote). Two agents may post; each is labeled with its session id.

## ⏰ Hard deadlines (from the Hacker Handbook)
- **Devpost submission: Sunday Sept 13, 9:00 AM CT.** Hacking ends then. 15-min warning at 8:45.
- **Video: 3–4 min**, mandatory on Devpost. Suggested cut: 30s intro, 2 min demo, 30s technical design, 30s impact.
- **Live judging: Sun 9:30 AM–12 PM.** 3 min per judge (2 min demo + 1 min Q&A), repeated 3–4 times. Whatever we build must demo cleanly in 2 minutes.
- **Tracks:** pick at most 1 of Healthcare / Finance / Games & Gamification / Work & Productivity. Sponsor challenges: enter as many as we want.
- **Judging criteria:** technical rigor, originality, UX/design, practicality/impact, relevance to the track/challenge.
- **Devpost themes:** Fintech, Health, ML/AI. Judges are generalist industry engineers and Rice CS researchers, not bankers, so the pitch must land with non-finance people.

## 🏆 Prizes we can stack (MLH sheet, 8 challenges, multi-entry allowed)
| Challenge | Prize |
|---|---|
| Best Use of Gemini API | Google swag kits |
| Best Use of ElevenLabs | Wireless earbuds |
| Best Use of Solana | Ledger Nano S Plus |
| Best Use of Tiger Data (Postgres time-series) | Stream Deck Mini |
| Best Use of Presage (camera vitals) | Fitbit Inspire + credits |
| Best Use of Vultr (cloud deploy) | Portable screens |
| Best Use of Backboard (AI memory API) | Tile Essentials pack |
| Best Domain Name (GoDaddy Registry) | Gift card |

Plus on Devpost: **Capital One "Best Financial Hack" (Nessie API), $250 per team member**, the biggest cash prize on the board.

## 🏦 Nessie API cheat sheet (verified live)
- Sign up at nessieisreal.com (GitHub login), key on /profile. Docs: nessieisreal.com/docs
- Base URL `https://api.nessieisreal.com`, HTTPS only. Auth is `?key=YOUR_KEY` on every request.
- Bad key returns `[]` with HTTP 200 on customer endpoints, so it fails silently.
- Customer endpoints (`/customers`, `/accounts`, purchases, deposits, withdrawals, transfers, bills, loans, merchants) allow full CRUD on data you create. `/enterprise/*` is read-only and returns everyone's shared sandbox data.
- ATMs and branches are real Capital One locations (Virginia area). All financial data is mock; we seed our own customers and transactions.
- Raw OpenAPI spec: `https://prod-api.nessieisreal.com/openapi`

## 🤖 How this channel feed works
- A Claude Code hook posts every prompt dev types and every final answer I give.
- Anyone can post a manual note from the repo: `python3 scripts/discord/notify.py "message"`
- To pause prompt mirroring set `DISCORD_POST_PROMPTS=0` in `.env`.
