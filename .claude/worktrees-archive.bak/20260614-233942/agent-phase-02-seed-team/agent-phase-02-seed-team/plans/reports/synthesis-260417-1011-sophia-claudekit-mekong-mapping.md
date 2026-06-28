# Synthesis — Sophia × (ClaudeKit + Mekong + AI-Video-Repos) Mapping
**Date:** 2026-04-17 | **Source reports:** `researcher-260417-1011-{ai-video-repos-comparison,claudekit-mekong-pattern-map}.md`

## TL;DR
Sophia is **60% aligned** with Mekong/ClaudeKit. Biggest gap = **operational telemetry** (no signal layer → founder blind on conversions). Two AI-video repos studied → most patterns blocked by edge runtime; only 1 worth porting now (timeout guard).

## Findings — Track B (ClaudeKit + Mekong → Sophia) — primary ask

| Pattern | Sophia has? | Effort | Edge-OK | Priority |
|---|---|---|---|---|
| 4-phase SDLC docs | ✅ | – | – | done |
| C-Level agents + journal | ✅ | – | – | done (this morning) |
| CI/CD gates (test/quality/security/canary) | ✅ | – | – | done |
| Agent self-review weekly loop | ⚠️ wired, **broken** | 1h debug | ✅ | **P0** |
| **D1 signal layer** (events: tier_conv, api_call, agent_action) | ❌ | 8h | ✅ | **P0** |
| **Weekly metrics digest** (D1 → GH Issue) | ❌ | 6h | ✅ | **P1** |
| KV feature-flag canary helper | ❌ | 2h | ✅ | P2 |
| Multi-tenant RaaS gate | ❌ | 16h | ✅ | DEFER (post-$10k MRR) |

## Findings — Track A (AI-video repos) — bonus inspiration
- **brightbean-studio**: social mgmt, **AGPL** → license-incompatible. Skip.
- **AI-Short-Video-Engine**: MIT, full Python pipeline. **FFmpeg inline render = 30s edge timeout death**. Skip core.
- **Worth porting**: timeout guard wrapper (A1, ~2h, defensive against silent timeouts on long routes — pure win).
- Multi-char dialogue + semantic material matching = product feature, premature pre-launch.

## Recommended Scope — Iteration 1
**P0 + P1 + A1** = ~17h total, all edge-compatible, zero new infra:
1. Fix agent-self-review loop (debug OpenRouter call, restore weekly cron)
2. D1 signal layer (`events` table, `track()` helper, instrument /api/check-access + /api/payments + agent dispatcher)
3. Weekly metrics digest (Python aggregator → posts to GH Issue every Mon 09:00 UTC)
4. Timeout guard wrapper (Workers fetch + AbortController, default 25s)

**Defer**: KV canary, multi-tenant RaaS, multi-char dialogue, semantic matching.

## Why this scope
- Solves founder's most painful blind spot (no conversion data) per Binh Pháp 虛實
- Reuses existing infra (D1 + GH Actions cron + journal write-back from morning)
- Zero violation of edge runtime, BYOK, or Polar-rejected payment constraints
- ~17h fits one parallel-execution sprint (3-4 fullstack-developer agents in parallel)

## Unresolved Qs
1. Which D1 events worth tracking *first*? (suggest: tier_conversion, payment_success, payment_failed, agent_dispatch, api_rate_limit_hit)
2. Where does timeout guard apply? (suggest: only routes calling external BYOK APIs — ElevenLabs, OpenRouter, D-ID)
3. Founder OK with weekly digest as GH Issue (vs Telegram/email)?
