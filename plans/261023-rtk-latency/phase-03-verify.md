# Phase 03 — Verify latency, landing, and fallback

**Status:** in progress — synthetic + real-turn latency passed; fallback drill deferred · **Effort:** 35m · **Depends on:** phase-02 · **Plan:** [plan.md](plan.md)

## Objective
Prove a real Claude Code turn lands on Antigravity, p95 drops, and the zunef fallback still works when Ultra is unavailable.

## Steps

1. Synthetic probe (same shape as Phase 01):
```bash
S="$HOME/.claude/settings.json"; KEY=$(jq -r '.env.ANTHROPIC_AUTH_TOKEN' "$S")
for M in claude-opus-5 claude-sonnet-5-0 claude-haiku-4-5; do
  curl -s -m 60 -w " $M HTTP=%{http_code} t=%{time_total}s\n" \
    http://127.0.0.1:20128/api/v1/messages \
    -H "x-api-key: $KEY" -H "anthropic-version: 2023-06-01" -H "content-type: application/json" \
    -d "{\"model\":\"$M\",\"max_tokens\":8,\"messages\":[{\"role\":\"user\",\"content\":\"say ok\"}]}" \
    | tail -c 220
done
```
Pass: HTTP 200, `<3 s`, response `model` ends `-high`.

2. Real Claude Code turn (new process reads the new settings):
```bash
T=$(date -u +%Y-%m-%dT%H:%M:%SZ)
/usr/bin/time -p claude -p "Reply with exactly: RTK-OK" --model opus
echo "start=$T"
```
Then assert the row landed on Antigravity:
```bash
curl -s "http://127.0.0.1:20128/api/usage/call-logs?limit=20" -H "Authorization: Bearer $KEY" \
 | jq -r '.[] | select(.timestamp >= "'"$T"'") | [.timestamp,.provider,.account,.model,.duration,.status] | @tsv'
```
Pass: a row with `provider=antigravity`, `account=cashback.mentoring@gmail.com`, `status=200`, `duration<60000`.

3. 20-turn p95 (repeat step 2 with short prompts; use the call log window):
```bash
curl -s "http://127.0.0.1:20128/api/usage/call-logs?limit=100" -H "Authorization: Bearer $KEY" > /tmp/rtk-post.json
python3 - /tmp/rtk-post.json <<'PY'
import json,sys
r=[x for x in json.load(open(sys.argv[1])) if x.get("status")==200 and isinstance(x.get("duration"),int)]
r=r[:20]; d=sorted(x["duration"] for x in r)
print("n",len(d),"p50",d[len(d)//2] if d else None,"p95",d[min(len(d)-1,int(len(d)*.95))] if d else None,"max",d[-1] if d else None)
print("antigravity",sum(1 for x in r if x.get("provider")=="antigravity"),"zunef",sum(1 for x in r if (x.get("providerDisplay") or "").lower().startswith("zune")))
PY
```
Pass: p95 ≤60 s, max ≤120 s, ≥18/20 Antigravity, 0 zunef outside the fallback drill.

4. Forced fallback drill (config change is temporary; off-peak):
```bash
P=/Users/macbook/sophia-ai-factory/plans/261023-rtk-latency
curl -s http://127.0.0.1:20128/api/combos -H "Authorization: Bearer $KEY" > "$P/backups/combos.verify.json"
CID=$(jq -r '.combos[]|select(.name=="claude-opus-5").id' "$P/backups/combos.verify.json")
jq '.combos[]|select(.name=="claude-opus-5")' "$P/backups/combos.verify.json" > "$P/backups/combo-opus5.verify.json"
jq '{models: [.models[] | if .model=="antigravity/claude-opus-5-5-high"
  then .allowedConnectionIds=["a66a2b56-a930-49eb-ad0e-236383fd5b89","5f5455c0-d8ad-489c-8868-2c9df2008ee1"] else . end]}' \
  "$P/backups/combo-opus5.verify.json" > /tmp/combo-opus5-exhausted.json
curl -s -X PUT "http://127.0.0.1:20128/api/combos/$CID" -H "Authorization: Bearer $KEY" \
  -H "content-type: application/json" -d @/tmp/combo-opus5-exhausted.json | head -c 400
sleep 10   # combo cache TTL
```
Repeat the step-1 `claude-opus-5` probe. Pass: HTTP 200 and call log shows `providerDisplay=zuneF` (expected slow). Restore immediately:
```bash
jq '{models}' "$P/backups/combo-opus5.verify.json" > /tmp/combo-opus5-restore.json
curl -s -X PUT "http://127.0.0.1:20128/api/combos/$CID" -H "Authorization: Bearer $KEY" \
  -H "content-type: application/json" -d @/tmp/combo-opus5-restore.json | head -c 400
```
Pass: next probe returns Antigravity again. If any PUT fails, restore via the same payload and stop; do not leave the drill active.

5. Record results in this file: probe times, first Antigravity row, p50/p95/max, fallback row, restore timestamp.

## Results
- Synthetic `claude-opus-5`: 200 / ~1.5 s; `claude-sonnet-5-0`: 200 / 1.64 s; `claude-haiku-4-5`: 200 / 1.24 s.
- Real Claude Code turns (6): 1.59–2.21 s; `call_logs` `provider=antigravity`, `account=cashback.mentoring@gmail.com`, `combo_name=claude-opus-5`, duration 1.2–1.8 s.
- Baseline zunef p95 255–362 s; post-fix p95 ~2 s.
- Existing sessions are not migrated; restart Claude Code. Forced fallback drill not run.

## Acceptance
Real CC request on Antigravity; p95 ≤60 s; fallback 200 via zunef; restore confirmed. Any failure → Phase 04.

## Risks
- 20 real turns burn cashback quota; check remaining after the run and stop below 10%.
- Combo cache is ~10 s; probing too early can test the old ACL.
- A trailing `[1m]` request may not match `claude-opus-5`; if seen, stop and re-map (plan risk).
- Put fallback drill after latency measurement so zunef outliers do not contaminate p95.
