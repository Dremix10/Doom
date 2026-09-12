# Discord: how Claude talks to the team

Two pieces:

1. **Two-way bot (main).** The official `discord@claude-plugins-official` plugin runs a bot
   that forwards channel messages into the Claude Code session and lets Claude reply,
   react, edit, and read history. This is how teammates ask Claude things and get answers.
2. **Webhook poster (manual only).** `scripts/discord/notify.py` posts a message through a
   channel webhook. Claude uses it for deliberate announcements (decisions, briefings).
   The automatic mirroring hooks were removed on request; nothing posts by itself.

## Starting a session that is connected to Discord
```
claude --channels plugin:discord@claude-plugins-official
```
Without the flag the bot does not connect. Bun must be on PATH (installed at ~/.bun, symlinked into /opt/homebrew/bin).

## One-time setup (done once per machine)
- Bot token lives in `~/.claude/channels/discord/.env` as `DISCORD_BOT_TOKEN=...`
  (set with `/discord:configure <token>` inside Claude Code, or write the file by hand).
- Access rules live in `~/.claude/channels/discord/access.json`. Enable the team channel with
  `/discord:access group add <channel id>` (add `--no-mention` to answer every message,
  otherwise only @mentions, replies to the bot, or messages containing "claude").
- `/discord:access` shows the current state.

## Manual announcements
```
python3 scripts/discord/notify.py "Decision: we are going with X"
python3 scripts/discord/notify.py --file docs/team-briefing.md
```
Webhook URL comes from `DISCORD_WEBHOOK_URL` in the project `.env` (gitignored).
