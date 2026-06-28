# Phase A — Eat-Own-Dogfood: Founder Sophia → Founder M1 Max mekongd

**Status:** pending | **Priority:** P0 | **Effort:** 1d | **Owner:** TBD

## Context Links
- Synthesis: `plans/reports/synthesis-260417-1130-sophia-local-mode.md`
- Integration recipe: `plans/reports/researcher-260417-1147-qwen36-mekongd-integration-recipe.md`
- Existing tunnel: memory `reference_m1max_cloudflare_tunnel.md` (`m1max-cf` SSH alias, `m1max.cashclaw.cc`)
- BYOK wrapper: `apps/sophia-ai-factory/src/lib/byok/with-timeout.ts`
- Target call: `apps/sophia-ai-factory/src/lib/discovery/affiliate-openrouter-niche-enhancer.ts`
- Sophia rules: `apps/sophia-ai-factory/CLAUDE.md`

## Overview
Validate end-to-end loop: founder's Sophia (CF Worker, prod) routes the affiliate niche-enhancer LLM call → founder's own M1 Max mekongd via the existing `m1max-cf` Cloudflare Tunnel. No customer surface. No D1 changes. Single env-var gate. Silent fallback if tunnel/mekongd down. Run for 1 week as burn-in before Phase B.

## Key Insights
- mekongd already shipped (PR #86) at `127.0.0.1:8765` w/ Anthropic-compat `/v1/messages`.
- Existing `m1max-cf` tunnel proves CF-Tunnel pattern works from any wifi.
- `withTimeout` already emits `byok_call` signal — using `provider: 'local-mekongd'` gives telemetry for free.
- Niche-enhancer already returns `null` on failure → graceful fallback already wired in caller.
- a16z compliance: founder is dogfooding self → no customer-facing ask required.

## Requirements

### Functional
1. If `process.env.SOPHIA_LOCAL_MEKONGD_URL` is set, niche-enhancer routes through new local adapter.
2. If env var absent, behavior identical to today (OpenRouter only).
3. If local call fails (timeout, non-2xx, network), fall through to OpenRouter call (existing path).
4. Optional bearer token via `SOPHIA_LOCAL_MEKONGD_BEARER` for tunnel auth.
5. Telemetry: `byok_call` signal emits w/ `provider: 'local-mekongd'`, `status_code`, `latency_ms`.

### Non-functional
- Edge-runtime safe (no Node-only APIs); reuses `withTimeout` (already edge-safe).
- TS strict, zero `:any`, Zod not required (no untrusted input here).
- `npm run build` 0 errors; `npm test` 100% green.
- Adapter file ≤ 80 LOC.

## Architecture
```
Sophia (CF Worker, prod)
  └── enhanceNicheScoreWithAI(program, niche)
        ├── if SOPHIA_LOCAL_MEKONGD_URL set
        │     └── callLocalMekongd(prompt, {endpoint, bearer?})
        │           └── withTimeout(POST /v1/messages, timeoutMs: 120_000, provider: 'local-mekongd')
        │                 ├── 200 → parse content[0].text → score
        │                 └── error → return null (caller falls back to OpenRouter)
        └── else → existing OpenRouter call path
```

mekongd request body: `{ model: 'Qwen/Qwen3.6-35B-A3B', messages: [...], max_tokens: 10, stream: false }`
mekongd response shape: `{ content: [{ type: 'text', text: '...' }], ... }`

CF Tunnel ingress on M1 Max (`~/.cloudflared/config.yml`):
```yaml
ingress:
  - hostname: mekongd.cashclaw.cc      # NEW
    service: http://127.0.0.1:8765
  - hostname: m1max.cashclaw.cc        # existing
    service: http://127.0.0.1:3000
  - service: http_status:404
```

## Related Code Files

### Create
- `apps/sophia-ai-factory/src/lib/byok/local-mekongd-adapter.ts` — new (≤80 LOC)
- `apps/sophia-ai-factory/src/lib/byok/local-mekongd-adapter.test.ts` — new (≥3 tests)
- `docs/sophia-local-mode-dogfood.md` — new (founder runbook, EN-only this phase)

### Modify
- `apps/sophia-ai-factory/src/lib/discovery/affiliate-openrouter-niche-enhancer.ts` — add 1 branch (≤15 LOC delta)

### Delete
- None.

## Implementation Steps

1. **Create adapter** `local-mekongd-adapter.ts`:
   - Export `callLocalMekongd(prompt: string, opts: {endpoint: string; bearer?: string; model?: string}): Promise<string | null>`.
   - POST to `${endpoint}/v1/messages` via `withTimeout` w/ `provider: 'local-mekongd'`, `timeoutMs: 120_000`.
   - Body: `{ model: opts.model ?? 'Qwen/Qwen3.6-35B-A3B', messages: [{role:'user',content:prompt}], max_tokens: 10, stream: false }`.
   - On non-200 or thrown error → return `null` (caller decides fallback).
   - Parse `data.content?.[0]?.text` defensively.

2. **Wire enhancer** in `affiliate-openrouter-niche-enhancer.ts`:
   - Read `process.env.SOPHIA_LOCAL_MEKONGD_URL` and `SOPHIA_LOCAL_MEKONGD_BEARER`.
   - If URL set, build prompt (reuse existing user-content string), call adapter; if returns string, parse to score (same `parseInt`/clamp logic), return it.
   - If adapter returned `null` → fall through to existing OpenRouter block (no early-return).

3. **Tests** (`local-mekongd-adapter.test.ts`):
   - `URL set + 200 with valid content → returns trimmed text`
   - `URL set + non-200 → returns null`
   - `URL set + thrown fetch error → returns null` (no rethrow)
   - (Bonus) `bearer header included when SOPHIA_LOCAL_MEKONGD_BEARER set`

4. **Wire enhancer test** in `affiliate-openrouter-niche-enhancer.test.ts` (extend if exists, else create):
   - `SOPHIA_LOCAL_MEKONGD_URL set + adapter returns "85" → score = 85, OpenRouter NOT called`
   - `SOPHIA_LOCAL_MEKONGD_URL absent → existing OpenRouter path unchanged`
   - `SOPHIA_LOCAL_MEKONGD_URL set + adapter returns null → falls back to OpenRouter`

5. **Build + test:**
   - `cd apps/sophia-ai-factory && npm run build` (0 errors)
   - `npm test -- byok/local-mekongd-adapter` (all green)

6. **Founder runbook** `docs/sophia-local-mode-dogfood.md`:
   - Section 1: Add ingress block to `~/.cloudflared/config.yml` on M1 Max
   - Section 2: `launchctl kickstart -k system/com.cloudflare.cloudflared`
   - Section 3: Verify `curl https://mekongd.cashclaw.cc/v1/messages -d '{...}'`
   - Section 4: Set CF Worker secret: `wrangler secret put SOPHIA_LOCAL_MEKONGD_URL` (value: `https://mekongd.cashclaw.cc`)
   - Section 5: Verify D1 signals: `SELECT * FROM signals_events WHERE props LIKE '%local-mekongd%' ORDER BY ts DESC LIMIT 5`

7. **Deploy + verify** (Green Production Rule):
   - `git push origin master` → CI green → CF Pages deploy success → `curl -sI https://sophia.agencyos.network` → 200.
   - Manually trigger one niche-enhancer call (existing endpoint or admin tool).
   - Confirm D1 signal `byok_call` w/ `provider: 'local-mekongd'`.

## Todo List
- [ ] Create `local-mekongd-adapter.ts`
- [ ] Create `local-mekongd-adapter.test.ts` (≥3 tests)
- [ ] Modify `affiliate-openrouter-niche-enhancer.ts` (add branch)
- [ ] Extend `affiliate-openrouter-niche-enhancer.test.ts` (≥3 cases)
- [ ] `npm run build` + `npm test` green
- [ ] Write `docs/sophia-local-mode-dogfood.md`
- [ ] Add CF Tunnel ingress on M1 Max + reload
- [ ] `wrangler secret put SOPHIA_LOCAL_MEKONGD_URL`
- [ ] Deploy + Green Production verification
- [ ] D1 signal sanity check (1 `byok_call` w/ provider='local-mekongd')

## Success Criteria
1. `npm run build` 0 errors, `npm test` 100% pass.
2. CF Pages deploy green; `https://sophia.agencyos.network` HTTP 200.
3. With `SOPHIA_LOCAL_MEKONGD_URL` set: at least 1 niche-enhancer call routes to mekongd, observable via D1 signal `byok_call` w/ provider='local-mekongd' AND status_code=200.
4. With env var unset OR mekongd down: niche-enhancer behavior identical to today (OpenRouter call succeeds).
5. No regressions in existing 844+ tests.

## Risk Assessment
| Risk | Impact | Mitigation |
|---|---|---|
| mekongd down → all niche calls slow (120s timeout) | medium | Lower timeout to 30s for first iteration; revisit after burn-in |
| CF Tunnel auth bypass (no bearer) | low (founder-only) | Add bearer in Phase B for customer rollout; doc warns |
| 120s timeout exceeds CF Worker 30s edge limit | HIGH | Cap `timeoutMs` at 25_000 (matches BYOK default); revise plan if M1 Max inference >25s for 10-token reply |
| Env var leak in client bundle | low | Server-only branch (Server Action / API route); verify no client import |
| Telemetry flood if mekongd returns 5xx repeatedly | low | Existing `byok_call` signal is per-call; no rate limiter needed at this scale |

**Action item from risk #3:** Set `timeoutMs: 25_000` in adapter (NOT 120_000 as recipe suggests). Niche-enhancer prompts return ~10 tokens; M1 Max should reply in 1-3s. If exceeded, that's a real problem to surface.

## Security Considerations
- `SOPHIA_LOCAL_MEKONGD_URL` and `SOPHIA_LOCAL_MEKONGD_BEARER` MUST be CF Worker Secrets (encrypted at rest), NOT env vars in `wrangler.toml`.
- Bearer token (if set) included via Authorization header — never logged (existing `withTimeout` doesn't log headers).
- No customer data flows in this phase (founder-only).
- D1 signals contain only provider name + status + latency (no key material per `with-timeout.ts:11`).
- No new auth surface — relies on CF Tunnel public hostname (acceptable for burn-in; Phase B adds bearer enforcement).

## File Ownership
- planner (this plan): all `phase-*.md` and `plan.md`
- implementer (Phase A code): adapter + enhancer + tests + dogfood doc

## Dependencies
- Upstream: mekongd v0.1.0+ running on M1 Max (already done — PR #86)
- Existing CF Tunnel `m1max-cf` (already done — memory `reference_m1max_cloudflare_tunnel.md`)
- Sophia BYOK timeout wrapper (already shipped — Phase 5)
- Sophia D1 signals + `track` (already shipped — Phase 1)

## Next Steps
1. After 1-week burn-in passes (no incidents, signals show consistent <5s latency, no fallback storms), schedule Phase B + C.
2. Capture latency p50/p95 from D1 signals → use as baseline for Phase B SLO.
3. If burn-in fails (e.g., M1 Max OOM, tunnel flapping), pivot to Docker+ngrok alternative (synthesis report §5 fallback).
