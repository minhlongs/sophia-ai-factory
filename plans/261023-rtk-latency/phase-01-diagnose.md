# Phase 01 — Diagnose and freeze baseline

**Status:** pending · **Effort:** 20m · **Depends on:** none · **Plan:** [plan.md](plan.md)

## Objective
Prove that literal `zunef/*` model IDs — not queue capacity — cause the latency, and freeze the exact baseline used by Phase 03. Read-only.

## Steps

1. Set local vars (no secret in output):
```bash
P=/Users/macbook/sophia-ai-factory/plans/261023-rtk-latency
S="$HOME/.claude/settings.json"
KEY=$(jq -r '.env.ANTHROPIC_AUTH_TOKEN' "$S")
TS=$(date -u +%Y%m%dT%H%M%SZ)
```

2. Snapshot settings and live combos:
```bash
cp "$S" "$P/backups/settings.pre-$TS.json"
curl -s http://127.0.0.1:20128/api/combos -H "Authorization: Bearer $KEY" \
  > "$P/backups/combos.pre-$TS.json"
jq empty "$P/backups/settings.pre-$TS.json" && echo settings-ok
```

3. Record every active model pin:
```bash
jq '{model, fallback:.["fallback-model"], env: (.env|with_entries(select(.key|test("ANTHROPIC|CLAUDE_CODE_AUTO_MODE"))))}' "$S"
env | grep -E '^ANTHROPIC_|^CLAUDE_CODE_AUTO_MODE' || true
ps eww -p "$(pgrep -n -f 'claude' || echo 0)" 2>/dev/null | tr ' ' '\n' | grep -E 'ANTHROPIC_MODEL|ANTHROPIC_DEFAULT' || true
```
Also check `~/.claude/settings.local.json`, repo `.claude/settings*.json`, `~/.config/opencode/*.json*`, `~/.codex/config.toml`, and shell startup files. Ignore `.bak*`, `file-history/`, `projects/*.jsonl`.

4. Confirm the key is all-mode (not the restricted desktop key):
```bash
curl -s http://127.0.0.1:20128/api/keys -H "Authorization: Bearer $KEY" \
 | jq -r '.keys[] | select(.keyPrefix=="sk-2a829b972") | [.name,.modelAccessMode,(.allowedCombos|join(",")),(.allowedModels|length)] | @tsv'
```
Expected: `claude-code-main-20261021b  all  *,combo/*,rtk-omni...  0`. If the active token maps to `claude-desktop-zunef` (restricted, 11 zunef models), stop: Phase 02 fails until the key is changed.

5. Freeze 7-day latency/route baseline (ms):
```bash
curl -s "http://127.0.0.1:20128/api/usage/call-logs?limit=500" -H "Authorization: Bearer $KEY" \
 > "$P/backups/call-logs.pre-$TS.json"
jq -r '.[] | select(.status==200) | [.timestamp,.provider,(.providerDisplay//.provider),.account,.duration,(.comboName//"-")] | @tsv' \
 "$P/backups/call-logs.pre-$TS.json" > "$P/backups/call-logs.pre-$TS.tsv"
python3 - "$P/backups/call-logs.pre-$TS.json" <<'PY'
import json,sys,statistics
rows=[r for r in json.load(open(sys.argv[1])) if r.get("status")==200 and isinstance(r.get("duration"),int)]
for label,pred in [("zunef",lambda r:(r.get("providerDisplay") or r.get("provider") or "").lower().startswith("zune")),("antigravity",lambda r:r.get("provider")=="antigravity")]:
    d=sorted(r["duration"] for r in rows if pred(r))
    if d: print(label,len(d),"p50",d[len(d)//2],"p95",d[min(len(d)-1,int(len(d)*.95))],"max",d[-1])
print("combos",sum(1 for r in rows if r.get("comboName")),"of",len(rows))
PY
```

6. Cross-check capacity claim (read-only): peak in-flight ≤26, queue p50, 0 leases. Record the source; do not change concurrency.

## Gate
Proceed only if: baseline zunef p95 >120 s, ≥80% of last 500 requests are zunef, active key is all-mode, and settings still contain literal `zunef/*`. Otherwise stop and re-scope.

## Artifacts
`backups/settings.pre-<ts>.json`, `backups/combos.pre-<ts>.json`, `backups/call-logs.pre-<ts>.{json,tsv}`, plus a short baseline note appended to this file.

## Risks
- Call-log `duration` can be ms for completed rows and live for `status:0`; filter to `status==200`.
- `providerDisplay` may be null for Antigravity; fall back to `provider=="antigravity"`.
- `ps eww` may show the wrapper, not the model process; absence of env is not proof — trust settings + next-turn call log.
