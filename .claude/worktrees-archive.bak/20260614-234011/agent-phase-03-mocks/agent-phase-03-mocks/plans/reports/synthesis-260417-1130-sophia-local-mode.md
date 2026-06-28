# Synthesis — Sophia Local Mode (Qwen 3.6 + mekongd + a16z solo)
**Date:** 2026-04-17 PM
**Source reports:** `researcher-260417-{1147-qwen36-mekongd-integration-recipe, 1130-sophia-local-mode-architecture}.md`

## Founder ask
"a16z solo company M1 Max 64GB 2TB SSD of Qwen3.6-35B-A3B deep Sophia để user RaaS tự run solo Company"

→ Enable Sophia RaaS customers with capable M1 Max to run their solo company largely on own hardware via mekongd + Qwen 3.6, minimum cloud surface.

## TL;DR
- **Qwen 3.6-35B-A3B**: 35B/3B-active MoE, Apache 2.0, ~21.5GB Q4_K_M, 25–35 tok/s on M1 Max, 262K ctx, tool-use ✅. **Fits 64GB easily with quantization.**
- **mekongd v0** (PR #86 just shipped): `POST /v1/messages` Anthropic-compat on `127.0.0.1:8765`. Already production-ready.
- **Cloudflare Tunnel**: founder already runs `m1max-cf` tunnel — pattern proven; add `mekongd.<host>` route → 127.0.0.1:8765.
- **a16z doctrine compliance**: research's MVP-A *violates* doctrine (asks customer to install/configure mekongd); MVP-B (auto-installer + auto-tunnel) complies but +5d effort.
- **Eat-own-dogfood path exists**: route founder's Sophia OpenRouter calls → founder's own mekongd via existing CF tunnel for 1 week burn-in BEFORE customer ship.

## Architecture sketch (MVP)
```
Customer M1 Max                          Sophia (CF Workers)
────────────────                          ─────────────────
mekongd:8765  ◀─── CF Tunnel ◀── HTTPS ── BYOK adapter
  │                                          │
  └─ Qwen 3.6 Q4_K_M                         └─ withTimeout (Phase 5)
                                             └─ track byok_call (Phase 1)
                                             └─ feature flag "local_mode"
                                                (Phase 4 KV helper)

D1 stores: encrypted tunnel_url + (optional) bearer token per user.
Setup wizard: 1 new tab "Local Mode" with health check.
Provider router: if local_mode_enabled → local-mekongd-adapter; else → openrouter.
```

## Reuses just-shipped infrastructure (260417 iteration)
- **`withTimeout` + BYOK signals** → wraps local adapter for free, emits same telemetry
- **D1 `signals_events`** → tracks `byok_call` w/ provider='local-mekongd' for ops visibility
- **KV feature flag `local_mode`** → percentage rollout (start 0%, eat-dogfood-only, then 10% → 100%)
- **Weekly digest** → automatically shows local-mode adoption next Monday

## What MUST stay cloud (immutable)
- NOWPayments IPN webhook (customer doesn't run a payment processor)
- Cloudflare D1 source-of-truth (founder needs cross-customer aggregates)
- Telegram bot endpoint (public webhook target)
- Public landing/marketing pages

## What CAN go local (MVP routes only inference)
- LLM calls (OpenRouter → mekongd) — biggest cost + privacy win
- Agent reasoning (CTO/CMO/CSO/COO `.sophia-factory/agents/`) — operates on customer data anyway
- (Future) D1 read-replica via SQLite mirror for offline dashboards — DEFER

## Effort estimates
| Slice | Effort | Comply a16z? | Notes |
|---|---|---|---|
| Lean MVP | 5d | ❌ partial | manual install steps; customer does ops |
| a16z-compliant MVP | 8-10d | ✅ | one-click installer + auto-tunnel + zero-touch |
| Document-only | 1d | n/a | defer impl until ≥1 paying customer demands it |

## Recommended sequence
1. **Eat own dogfood (1d)**: founder's Sophia instance → founder's M1 Max mekongd via existing tunnel. Just point env var. 1-week burn-in.
2. **a16z-compliant MVP (8-10d)** AFTER burn-in proves the loop works end-to-end. Customer-shippable.

## Founder open Qs (decide before plan)
1. **Scope**: Lean MVP / a16z-compliant / Document-only?
2. **Eat own dogfood first?** Y = 1d cheap test before any customer-facing build. N = build customer feature directly.
3. **First customer-facing route**: which provider call goes through local-mode FIRST? (suggest: OpenRouter `affiliate-niche-enhancer` since it's the most-used + highest-cost call)

## Unresolved technical Qs (deferred to plan)
- D1 encryption for stored CF tunnel tokens (use `crypto.subtle` AES-GCM w/ KV-stored DEK)
- mekongd auto-install one-liner: brew formula vs curl-pipe-bash vs Tauri installer
- Fallback semantics: local timeout/down → silent fallback to OpenRouter (BYOK key still required) OR hard-fail w/ user notification?
- Multi-machine routing (laptop + desktop): defer to v2
- Polar compliance for "local AI" wording in customer-facing copy (Polar already rejected Sophia, so not a blocker — using NOWPayments)
