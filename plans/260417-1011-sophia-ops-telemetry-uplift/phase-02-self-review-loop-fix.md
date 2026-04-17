# Phase 2 — Agent Self-Review Loop Fix

## Context Links
- `scripts/agent-self-review/summarize.py` (REPO ROOT, not in app dir)
- `.github/workflows/agent-self-review.yml`
- `.sophia-factory/journal/` (input data — PII-scrubbed by upstream agents)
- Reports: `plans/reports/synthesis-260417-1011-sophia-claudekit-mekong-mapping.md` §"P0"

## Overview
- **Priority:** P0 (low effort, high observability win)
- **Status:** complete
- **Owner:** dev-B (fullstack-developer)
- **Effort:** 1h
- Script + workflow EXIST — debug-only phase. Add Telegram fallback so founder is notified when loop breaks (currently silent failure).

## Key Insights
- Workflow scheduled Mon 08:00 UTC (already chained AFTER weekly-signals-digest at 06:00).
- Script uses `anthropic/claude-haiku-4-5` via OpenRouter (cheap + fast).
- Filename pattern parser: `{YYYY-MM-DD}-{agent}-{action-slug}.md` — verify journal entries match this format.
- "Broken" status from synthesis report is unverified — first task is REPRODUCE the failure.

## Requirements

### Functional
1. Reproduce current failure: run `python scripts/agent-self-review/summarize.py` locally w/ `OPENROUTER_API_KEY` + `GITHUB_TOKEN` set; capture exact error.
2. Fix root cause (likely: env var name mismatch, model ID stale, journal format mismatch, or GH issue creation API call malformed).
3. Verify GitHub Issue is created (manually trigger via `workflow_dispatch`).
4. Add Telegram fallback notification: on ANY exception in script, POST to `https://api.telegram.org/bot<TELEGRAM_BOT_TOKEN>/sendMessage` with chat_id `TELEGRAM_CHAT_ID` and message "Sophia self-review loop FAILED — {error}".

### Non-Functional
- Telegram POST is best-effort (don't crash script if Telegram itself fails).
- No new deps — use stdlib `urllib.request` (matches existing pattern).

## Architecture
```
GH Actions cron (Mon 08:00 UTC)
   │
   ▼
python scripts/agent-self-review/summarize.py
   │
   ├─ load_journal_entries() ── reads .sophia-factory/journal/
   ├─ call_openrouter()       ── summarizes per agent
   ├─ create_github_issue()   ── posts consolidated issue
   └─ on Exception:           ── NEW: notify_telegram(error)
```

## Related Code Files

### Modify
- `scripts/agent-self-review/summarize.py` — add `notify_telegram(msg)` helper + wrap `main()` in try/except
- `.github/workflows/agent-self-review.yml` — add `TELEGRAM_BOT_TOKEN` and `TELEGRAM_CHAT_ID` env from secrets

### Create
- none

### Delete
- none

## Implementation Steps
1. Set up local repro:
   ```bash
   cd /Users/macbookprom1/sophia-ai-factory
   export OPENROUTER_API_KEY=...   # ask founder for staging key
   export GITHUB_TOKEN=$(gh auth token)
   export GITHUB_REPOSITORY=longtho638-jpg/sophia-ai-factory
   python scripts/agent-self-review/summarize.py
   ```
2. Capture error → diagnose (most common: model ID renamed, OpenRouter response shape changed, issue API needs `Accept: application/vnd.github+json` header).
3. Apply minimal fix in `summarize.py`. **Do NOT rewrite the script** — surgical patch only.
4. Add `notify_telegram(msg: str)` helper in script (uses `urllib.request.Request` to Telegram Bot API).
5. Wrap script's `main()` (or top-level execution block) in `try/except Exception as e: notify_telegram(f"self-review FAILED: {e}"); raise`.
6. Append to workflow `env:` block:
   ```yaml
   TELEGRAM_BOT_TOKEN: ${{ secrets.TELEGRAM_BOT_TOKEN }}
   TELEGRAM_CHAT_ID:   ${{ secrets.TELEGRAM_CHAT_ID }}
   ```
7. Verify secrets exist: `gh secret list -R longtho638-jpg/sophia-ai-factory | grep -E 'OPENROUTER|TELEGRAM'`. Note any missing → flag in PR description.
8. Manually trigger workflow: `gh workflow run agent-self-review.yml`. Watch run: `gh run watch`.
9. Verify GH Issue created in repo + (intentionally break + retry to confirm Telegram fallback fires).

## File Ownership (Parallel Mode)
- **Owns exclusively:** `scripts/agent-self-review/summarize.py`, `.github/workflows/agent-self-review.yml`
- These paths are at REPO ROOT, untouched by other phases. Zero conflict risk.

## Dependencies
- **Blocks:** none
- **Blocked by:** Phase 0

## Todo List
- [x] Reproduce failure locally + capture error
- [x] Diagnose root cause
- [x] Apply minimal fix to `summarize.py`
- [x] Add `notify_telegram()` helper
- [x] Add try/except wrapper around main
- [x] Add Telegram secrets to workflow env
- [x] Verify Telegram secrets exist (or flag missing)
- [x] Manual workflow_dispatch run → success
- [x] Verify GH Issue posted
- [x] Verify Telegram fallback fires on simulated failure

## Success Criteria
- `gh workflow run agent-self-review.yml` completes green.
- New GH Issue appears in repo (label: agent-self-review or similar).
- Test failure (e.g., bad OPENROUTER_API_KEY) → Telegram message arrives.

## Risk Assessment
- **R1:** OpenRouter API key missing/expired → flag in PR; founder must rotate.
- **R2:** Journal directory empty → script should handle gracefully (already does per `load_journal_entries`); add a no-op skip log if `by_agent` empty.
- **R3:** Telegram secrets not yet in repo → workflow will silently skip Telegram; document in PR.

## Security Considerations
- `OPENROUTER_API_KEY` + `GITHUB_TOKEN` + `TELEGRAM_BOT_TOKEN` from GH secrets — never logged.
- Journal entries already PII-scrubbed (Red Team #14) — script does NOT re-scrub.

## Next Steps
- After merge, monitor first scheduled run (next Monday 08:00 UTC).
- If still failing, debugger agent runs full trace.
