#!/usr/bin/env python3
"""Claude Code hook -> Discord bridge.

Wired in .claude/settings.json. Receives the hook's JSON on stdin and posts a
summary to the team channel via notify.py. Events handled:

  SessionStart      -> "session started" (only for fresh startups, not resume/compact)
  UserPromptSubmit  -> what the human asked (set DISCORD_POST_PROMPTS=0 to disable)
  Stop              -> Claude's final message for the turn (the decisions / results)

Every branch fails soft: any error is printed to stderr and the exit code is 0,
so a Discord outage never blocks the session.
"""
from __future__ import annotations

import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import notify  # noqa: E402

PROMPT_PREVIEW = 700


def env_flag(name: str, default: bool) -> bool:
    val = os.environ.get(name) or notify.load_dotenv_value(name)
    if val is None:
        return default
    return val.strip().lower() not in ("0", "false", "no", "off", "")


def agent_name(data: dict) -> str:
    """Label posts so two agents working in the same folder are distinguishable."""
    custom = os.environ.get("DISCORD_AGENT_NAME") or notify.load_dotenv_value("DISCORD_AGENT_NAME")
    if custom:
        return custom
    sid = str(data.get("session_id", ""))[:8] or "unknown"
    return f"Claude [{sid}]"


def last_assistant_text(transcript_path: str) -> tuple[str, str]:
    """Return (message_id, text) for the final assistant message in the transcript.

    Lines hold one content block each, grouped by message.id, so collect every
    text block sharing the id of the last main-thread assistant line.
    """
    try:
        with open(transcript_path, encoding="utf-8") as fh:
            lines = fh.readlines()
    except OSError:
        return "", ""
    target_id = None
    texts: list[str] = []
    for raw in reversed(lines):
        try:
            entry = json.loads(raw)
        except json.JSONDecodeError:
            continue
        if entry.get("type") != "assistant" or entry.get("isSidechain"):
            continue
        msg = entry.get("message") or {}
        mid = msg.get("id")
        if target_id is None:
            target_id = mid
        if mid != target_id:
            break
        for block in msg.get("content") or []:
            if isinstance(block, dict) and block.get("type") == "text" and block.get("text"):
                texts.append(block["text"])
    texts.reverse()
    return target_id or "", "\n".join(texts).strip()


STATE_DIR = os.path.join(os.path.expanduser("~"), ".cache", "hackrice16-discord")


def already_posted(session_id: str, message_id: str) -> bool:
    """Stop also fires on compact/resume; skip if this message id was posted already."""
    if not message_id:
        return False
    os.makedirs(STATE_DIR, exist_ok=True)
    marker = os.path.join(STATE_DIR, f"last-{session_id or 'unknown'}")
    try:
        with open(marker, encoding="utf-8") as fh:
            if fh.read().strip() == message_id:
                return True
    except OSError:
        pass
    with open(marker, "w", encoding="utf-8") as fh:
        fh.write(message_id)
    return False


def handle(data: dict) -> None:
    event = data.get("hook_event_name", "")
    who = agent_name(data)

    if event == "SessionStart":
        if data.get("source", "startup") != "startup":
            return
        folder = os.path.basename(data.get("cwd") or os.getcwd())
        notify.post(f"🟢 **Session started** in `{folder}`", username=who)

    elif event == "UserPromptSubmit":
        if not env_flag("DISCORD_POST_PROMPTS", True):
            return
        prompt = (data.get("prompt") or "").strip()
        if not prompt or prompt.startswith("/"):
            return  # skip slash commands and empty prompts
        if len(prompt) > PROMPT_PREVIEW:
            prompt = prompt[:PROMPT_PREVIEW].rstrip() + " …"
        notify.post(f"👤 **Prompt:** {prompt}", username=who)

    elif event == "Stop":
        if data.get("stop_hook_active"):
            return  # avoid re-posting when a stop hook re-triggered the model
        text = (data.get("last_assistant_message") or "").strip()
        mid = ""
        if data.get("transcript_path"):
            mid, transcript_text = last_assistant_text(data["transcript_path"])
            text = text or transcript_text
        if text and not already_posted(str(data.get("session_id", "")), mid):
            notify.post(f"🤖 **Update**\n{text}", username=who)


def main() -> int:
    try:
        data = json.load(sys.stdin)
    except Exception as e:
        print(f"discord hook: bad stdin JSON: {e}", file=sys.stderr)
        return 0
    try:
        handle(data)
    except Exception as e:
        print(f"discord hook: {e}", file=sys.stderr)
    return 0


if __name__ == "__main__":
    sys.exit(main())
