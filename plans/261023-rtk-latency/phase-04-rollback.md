# Phase 04 — Rollback

**Status:** pending · **Effort:** 10m · **Depends on:** phase-03 · **Plan:** [plan.md](plan.md)

## Objective
Return Claude Code to the exact pre-change routing in <2 min, without touching Omni services.

## Triggers
Wrong landing, p95 above target after 20 turns, repeated 4xx/5xx, missing `[1m]` combo, or quota <10%.

## Steps

1. Restore settings:
```bash
P=/Users/macbook/sophia-ai-factory/plans/261023-rtk-latency
S="$HOME/.claude/settings.json"
B=$(ls -1t "$P"/backups/settings.pre-*.json | tail -1)   # earliest = pre-change snapshot
cp "$B" "$S" && jq empty "$S" && echo restored
jq -r '.model, .env.ANTHROPIC_MODEL, .env.ANTHROPIC_DEFAULT_OPUS_MODEL' "$S"
```
Expected: `zunef/claude-opus-5-5` on all three.

2. Restore the combo if the fallback drill or Phase 05 did not complete:
```bash
KEY=$(jq -r '.env.ANTHROPIC_AUTH_TOKEN' "$S")
CID=$(curl -s http://127.0.0.1:20128/api/combos -H "Authorization: Bearer $KEY" \
 | jq -r '.combos[]|select(.name=="claude-opus-5").id')
jq '{models}' "$P/backups/combo-opus5.verify.json" > /tmp/combo-opus5-restore.json
curl -s -X PUT "http://127.0.0.1:20128/api/combos/$CID" -H "Authorization: Bearer $KEY" \
 -H "content-type: application/json" -d @/tmp/combo-opus5-restore.json | head -c 300
sleep 10
```

3. Restart Claude Code and prove the old path:
```bash
ps eww -p "$(pgrep -n -f 'claude' || echo 0)" 2>/dev/null | tr ' ' '\n' | grep '^ANTHROPIC_MODEL='
curl -s -m 60 -w '\nHTTP=%{http_code} t=%{time_total}s\n' http://127.0.0.1:20128/api/v1/messages \
 -H "x-api-key: $KEY" -H "anthropic-version: 2023-06-01" -H "content-type: application/json" \
 -d '{"model":"zunef/claude-opus-5-5","max_tokens":8,"messages":[{"role":"user","content":"say ok"}]}' | tail -c 300
```
Pass: env is `zunef/claude-opus-5-5`, HTTP 200, call log shows zunef. Latency may be slow again — expected.

4. Record rollback timestamp, restored files, and the probe row in this file.

## Notes
- Old sessions keep combo names until restarted; rollback is not complete until a fresh process is verified.
- Do not restart the gateway; combos are hot and the drill restore is a PUT.
- If the settings backup is missing/corrupt, use `~/.claude/settings.json.bak-rtk-latency-*` or `.bak-doctor-*`; never hand-edit.
