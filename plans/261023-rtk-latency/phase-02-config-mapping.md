# Phase 02 — Config mapping (Claude Code + RTK aliases)

**Status:** completed 2026-10-23T15:05Z · **Effort:** 20m · **Depends on:** phase-01 · **Plan:** [plan.md](plan.md)

## Objective
Repoint eight model pins to combo names. No Omni code, combo, ACL, or gateway restart.

## Target mapping
| Location | Value |
|---|---|
| `.model` | `claude-opus-5` |
| `.env.ANTHROPIC_MODEL` | `claude-opus-5` |
| `.env.ANTHROPIC_DEFAULT_OPUS_MODEL` | `claude-opus-5` |
| `.env.ANTHROPIC_DEFAULT_SONNET_MODEL` | `claude-sonnet-5-0` |
| `.env.ANTHROPIC_DEFAULT_HAIKU_MODEL` | `claude-haiku-4-5` |
| `.env.ANTHROPIC_SMALL_FAST_MODEL` | `claude-haiku-4-5` |
| `.env.CLAUDE_CODE_AUTO_MODE_MODEL` | `claude-haiku-4-5` |
| `.["fallback-model"]` | `["claude-opus-5","claude-sonnet-5-0"]` |

Unchanged: `ANTHROPIC_BASE_URL`, `ANTHROPIC_AUTH_TOKEN`, `ANTHROPIC_DEFAULT_FABLE_MODEL=claude-fable-5`, timeouts, context limits.

## Steps

1. Backup (same timestamp as Phase 01 is fine; never overwrite an existing `.bak`):
```bash
P=/Users/macbook/sophia-ai-factory/plans/261023-rtk-latency
S="$HOME/.claude/settings.json"
B="$P/backups/settings.pre-$(date -u +%Y%m%dT%H%M%SZ).json"
cp "$S" "$B"
```

2. Rewrite atomically with `jq` (preserves all other keys):
```bash
jq '
  .model = "claude-opus-5"
  | .env.ANTHROPIC_MODEL = "claude-opus-5"
  | .env.ANTHROPIC_DEFAULT_OPUS_MODEL = "claude-opus-5"
  | .env.ANTHROPIC_DEFAULT_SONNET_MODEL = "claude-sonnet-5-0"
  | .env.ANTHROPIC_DEFAULT_HAIKU_MODEL = "claude-haiku-4-5"
  | .env.ANTHROPIC_SMALL_FAST_MODEL = "claude-haiku-4-5"
  | .env.CLAUDE_CODE_AUTO_MODE_MODEL = "claude-haiku-4-5"
  | .["fallback-model"] = ["claude-opus-5","claude-sonnet-5-0"]
' "$B" > "$S.tmp" && jq empty "$S.tmp" && mv "$S.tmp" "$S"
```

3. Diff must show exactly those fields:
```bash
diff -u "$B" "$S"
jq -r '.model, .env.ANTHROPIC_MODEL, .env.ANTHROPIC_DEFAULT_OPUS_MODEL, .env.ANTHROPIC_DEFAULT_SONNET_MODEL, .env.ANTHROPIC_DEFAULT_HAIKU_MODEL, .env.ANTHROPIC_SMALL_FAST_MODEL, .env.CLAUDE_CODE_AUTO_MODE_MODEL, (.["fallback-model"]|join(","))' "$S"
```
Expected lines: `claude-opus-5`, `claude-opus-5`, `claude-opus-5`, `claude-sonnet-5-0`, `claude-haiku-4-5`, `claude-haiku-4-5`, `claude-haiku-4-5`, `claude-opus-5,claude-sonnet-5-0`.

4. Assert no remaining literal pins in the active config:
```bash
jq -r '.. | strings | select(test("^zunef/"))' "$S"
```
Expected: empty. Backups/history are intentionally ignored.

5. Restart Claude Code (env is read at process start). Quit all sessions for the current user, then launch a new one. Confirm:
```bash
ps eww -p "$(pgrep -n -f 'claude' || echo 0)" 2>/dev/null | tr ' ' '\n' | grep -E '^ANTHROPIC_MODEL=|^ANTHROPIC_DEFAULT_OPUS_MODEL='
```
Expected: `claude-opus-5`.

6. RTK/other clients: `rtk-omni`, `rtk-omni-fast`, `rtk-omni-coding`, `rtk-omni-uiux` already start with Antigravity and end with zunef. No edit. If a client config still contains `zunef/*`, change that client to `rtk-omni-fast` (or `claude-opus-5`) and record the file; do not edit combos.

## Applied
- Backup: `backups/settings.pre-20261023T150513Z.json`.
- Diff touches only the eight mapped fields; `jq empty` passes; no `^zunef/` strings remain.
- New process: `claude -p --model claude-opus-5 --bare` returned `RTK-OK` in 1.94 s.
- No Omni combo/gateway change; no restart.

## Gate
Do not proceed to Phase 03 until the new process reports the combo name. A file edit alone does not change a running session.

## Rollback
`cp "$B" "$S"` and restart. No Omni change to undo.

## Risks
- `jq` re-serializes the 24 KB file (2-space, no comments). If the file is JSONC or `jq empty` fails, stop and use a text-preserving editor.
- Project-level `.claude/settings.local.json` can override; Phase 01 scan decides whether an extra edit is needed.
- The desktop key is restricted to 11 zunef models; do not “fix” latency by swapping to it.
- Combo names are case-sensitive; verify against `/api/combos` before writing.
