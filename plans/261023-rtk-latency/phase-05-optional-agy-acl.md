# Phase 05 — Optional: add the `agy` cashback twin to the ladders

**Status:** pending · **Effort:** 15m · **Depends on:** phase-03 (measured) · **Plan:** [plan.md](plan.md)

## Trigger
Only if, after Phase 02/03, Antigravity still caps concurrency or p95 >30 s while `agy` cashback (`dc96ba4d-7213-46b4-8964-56a31f586420`) has headroom (99.74%). Do **not** add preemptively.

## Change (combos only; no code, no settings)
Add one `agy` entry per Claude opus/sonnet ladder, immediately after the IDE Antigravity entry. Haiku inherits the sonnet-first step; do not edit `rtk-omni-free` or image combos.

```bash
P=/Users/macbook/sophia-ai-factory/plans/261023-rtk-latency
KEY=$(jq -r '.env.ANTHROPIC_AUTH_TOKEN' "$HOME/.claude/settings.json")
curl -s http://127.0.0.1:20128/api/combos -H "Authorization: Bearer $KEY" > "$P/backups/combos.pre-agy.json"

for N in claude-opus-5 claude-sonnet-5-0; do
  CID=$(jq -r --arg n "$N" '.combos[]|select(.name==$n).id' "$P/backups/combos.pre-agy.json")
  jq --arg n "$N" '.combos[]|select(.name==$n)' "$P/backups/combos.pre-agy.json" > "$P/backups/combo-$N.pre-agy.json"
  jq --arg p "$( [ "$N" = "claude-opus-5" ] && echo agy/claude-opus-5-5-high || echo agy/claude-sonnet-5-5-high )" \
    '{models: (.models[0:1] + [(.models[0] | .id=(.id+"-agy") | .model=$p | .providerId="agy"
      | .label="Antigravity CLI cashback (agy)" | .allowedConnectionIds=["dc96ba4d-7213-46b4-8964-56a31f586420"])] + .models[1:])}' \
    "$P/backups/combo-$N.pre-agy.json" > /tmp/combo-agy-$N.json
  curl -s -X PUT "http://127.0.0.1:20128/api/combos/$CID" -H "Authorization: Bearer $KEY" \
    -H "content-type: application/json" -d @/tmp/combo-agy-$N.json | head -c 300; echo
done
sleep 10   # combo cache TTL
```

## Verify
```bash
curl -s -m 60 -w ' HTTP=%{http_code} t=%{time_total}s\n' http://127.0.0.1:20128/api/v1/messages \
 -H "x-api-key: $KEY" -H "anthropic-version: 2023-06-01" -H "content-type: application/json" \
 -d '{"model":"claude-opus-5","max_tokens":8,"messages":[{"role":"user","content":"say ok"}]}' | tail -c 300
curl -s "http://127.0.0.1:20128/api/usage/call-logs?limit=10" -H "Authorization: Bearer $KEY" \
 | jq -r '.[]|[.timestamp,.provider,.account,.duration,.status]|@tsv' | head -5
```
Pass: HTTP 200, `<3 s`, a row with `provider=agy` / `account=cashback.mentoring@gmail.com`, then repeat Phase 03 p95. Do not keep the change if p95 does not improve.

## Rollback
```bash
for N in claude-opus-5 claude-sonnet-5-0; do
  CID=$(jq -r --arg n "$N" '.combos[]|select(.name==$n).id' "$P/backups/combos.pre-agy.json")
  jq '{models}' "$P/backups/combo-$N.pre-agy.json" > /tmp/restore-$N.json
  curl -s -X PUT "http://127.0.0.1:20128/api/combos/$CID" -H "Authorization: Bearer $KEY" \
    -H "content-type: application/json" -d @/tmp/restore-$N.json | head -c 200; echo
done
```

## Risks
- `agy` is a CLI OAuth connection; token refresh/expiry is independent of the IDE sessions and can fail mid-run.
- The twin shares the same Google Ultra account; it adds concurrency, not new quota.
- Combo entry shape must match existing steps (`id`, `kind`, `model`, `providerId`, `weight`, `label`, `allowedConnectionIds`); reject any 400 and restore.
- This phase is out of the minimal-fix scope; track separately in the plan journal if skipped.
