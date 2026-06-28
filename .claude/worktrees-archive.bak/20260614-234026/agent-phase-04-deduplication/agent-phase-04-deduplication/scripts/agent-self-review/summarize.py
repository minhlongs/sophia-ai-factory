#!/usr/bin/env python3
"""
Sophia Factory — Agent Self-Review (Benevolent Neglect Loop)

Reads .sophia-factory/journal/ entries from last 7 days, groups by agent,
sends each agent's actions to OpenRouter for prompt-improvement suggestions,
posts results as a single consolidated GitHub Issue.

Triggered weekly by .github/workflows/agent-self-review.yml.

NO repo writes. PII-scrubbed by upstream agents before commit (Red Team #14).
"""
from __future__ import annotations

import json
import os
import sys
import urllib.request
from datetime import UTC, datetime, timedelta
from pathlib import Path

JOURNAL_DIR = Path(".sophia-factory/journal")
WINDOW_DAYS = 7
OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"
MODEL = "anthropic/claude-haiku-4-5"  # cheap + fast for summarization

TELEGRAM_API_URL = "https://api.telegram.org/bot{token}/sendMessage"


def notify_telegram(msg: str) -> None:
    """Best-effort Telegram notification — never raises."""
    token = os.environ.get("TELEGRAM_BOT_TOKEN", "")
    chat_id = os.environ.get("TELEGRAM_CHAT_ID", "")
    if not token or not chat_id:
        return  # secrets not provisioned — silent skip
    try:
        payload = {"chat_id": chat_id, "text": msg, "parse_mode": "HTML"}
        req = urllib.request.Request(
            TELEGRAM_API_URL.format(token=token),
            data=json.dumps(payload).encode("utf-8"),
            headers={"Content-Type": "application/json"},
        )
        with urllib.request.urlopen(req, timeout=10) as _:
            pass
    except Exception:  # noqa: BLE001 — best-effort, never propagate
        pass


PROMPT_TEMPLATE = """You are reviewing the past 7 days of work by the **{agent}** agent in Sophia AI Factory.

Below are the journal entries. Suggest the top 3 prompt-improvement opportunities.
Be brutally honest. Skip praise. Focus on:
- Patterns where the agent could have been more effective
- Missing context the agent should have requested
- Tools the agent under-used or mis-used
- Output quality issues

Respond in this exact format:
1. **[Issue]** — [why it matters] — [concrete fix in agent prompt]
2. ...
3. ...

Journal entries:
{entries}
"""


def load_journal_entries(window_days: int = WINDOW_DAYS) -> dict[str, list[str]]:
    """Returns {agent: [entry_text, ...]} for entries in window."""
    if not JOURNAL_DIR.exists():
        return {}

    cutoff = datetime.now(UTC) - timedelta(days=window_days)
    by_agent: dict[str, list[str]] = {}

    for entry_path in sorted(JOURNAL_DIR.glob("*.md")):
        # Filename pattern: {YYYY-MM-DD}-{agent}-{action-slug}.md
        parts = entry_path.stem.split("-", 4)
        if len(parts) < 5:
            continue
        try:
            entry_date = datetime.strptime("-".join(parts[:3]), "%Y-%m-%d").replace(tzinfo=UTC)
        except ValueError:
            continue
        if entry_date < cutoff:
            continue
        agent = parts[3]
        by_agent.setdefault(agent, []).append(entry_path.read_text(encoding="utf-8"))

    return by_agent


def call_openrouter(prompt: str, api_key: str) -> str:
    payload = {
        "model": MODEL,
        "messages": [{"role": "user", "content": prompt}],
        "max_tokens": 800,
        "temperature": 0.4,
    }
    req = urllib.request.Request(
        OPENROUTER_URL,
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
            "HTTP-Referer": "https://sophia.agencyos.network",
            "X-Title": "Sophia Agent Self-Review",
        },
    )
    with urllib.request.urlopen(req, timeout=60) as resp:
        body = json.loads(resp.read())
    return body["choices"][0]["message"]["content"]


def post_github_issue(title: str, body: str, repo: str, token: str) -> str:
    url = f"https://api.github.com/repos/{repo}/issues"
    payload = {"title": title, "body": body, "labels": ["agent-self-review", "automation"]}
    req = urllib.request.Request(
        url,
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Authorization": f"Bearer {token}",
            "Accept": "application/vnd.github+json",
            "Content-Type": "application/json",
        },
    )
    with urllib.request.urlopen(req, timeout=30) as resp:
        return json.loads(resp.read())["html_url"]


def main() -> int:
    api_key = os.environ.get("OPENROUTER_API_KEY")
    gh_token = os.environ.get("GITHUB_TOKEN")
    repo = os.environ.get("GITHUB_REPOSITORY", "longtho638-jpg/sophia-ai-factory")

    if not api_key:
        msg = "Sophia self-review skipped — OPENROUTER_API_KEY not provisioned. Rotate via GH Secrets."
        print(msg, file=sys.stderr)
        notify_telegram(msg)
        return 0  # not a failure (graceful no-op until secret provisioned)

    entries_by_agent = load_journal_entries()
    if not entries_by_agent:
        print("No journal entries in last 7 days — skipping (expected pre-activation)")
        return 0

    sections = []
    for agent, entries in sorted(entries_by_agent.items()):
        joined = "\n\n---\n\n".join(entries[:20])  # cap to avoid token blow-up
        prompt = PROMPT_TEMPLATE.format(agent=agent, entries=joined[:8000])
        suggestions = call_openrouter(prompt, api_key)
        sections.append(f"## {agent.upper()} ({len(entries)} entries)\n\n{suggestions}\n")

    if not sections:
        return 0

    body = (
        f"# Agent Self-Review — Week of {datetime.now(UTC).strftime('%Y-%m-%d')}\n\n"
        f"_Auto-generated by `.github/workflows/agent-self-review.yml` (benevolent neglect loop)._\n\n"
        f"Review suggestions below. Apply approved improvements to "
        f"`.sophia-factory/agents/<agent>.md` via PR.\n\n"
        + "\n".join(sections)
        + "\n\n---\n\n_Strategic pillar #3 from DeepSeek Solo-Platform PDF._\n"
    )

    title = f"[Self-Review] Agent improvement suggestions — {datetime.now(UTC).strftime('%Y-W%V')}"
    if gh_token:
        url = post_github_issue(title, body, repo, gh_token)
        print(f"Posted issue: {url}")
    else:
        print(title)
        print(body)
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except Exception as exc:
        notify_telegram(f"Sophia self-review FAILED: {exc}")
        raise
