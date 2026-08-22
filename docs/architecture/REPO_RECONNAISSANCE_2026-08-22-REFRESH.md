# Repository Reconnaissance Refresh — 2026-08-22

> **Delta against:** `docs/architecture/REPO_RECONNAISSANCE_2026-08-17.md` (289 lines, 18 sections).
> **Method:** per-section verify-then-delta. The 2026-08-17 original is NOT rewritten.
> **HEAD:** `458de90089c4725698e6017c6c7f5b6431218d88` on `main`, working tree clean.
> **Commits since 2026-08-17:** **53** (the 2026-08-17 report's "~15" estimate was an underestimate).

---

## Section-by-section status

| # | Section (2026-08-17) | Status | Evidence / change since 2026-08-17 |
|---|---|---|---|
| 1 | Current architecture | **CHANGED** | 4-layer model (seed → tree → forest → land) unchanged; `src/seed/types/creative-domain.ts` now 663 lines (was fewer); new `src/seed/types/creative-economy/` contracts being created this run |
| 2 | Runtime topology | **VERIFIED** | Cloudflare Workers via OpenNext; `npm run deploy:full` (CF-direct). Unchanged |
| 3 | Data topology | **CHANGED** | D1 `sophia-raas-db` unchanged; migrations now **218** `.sql` files, newest `0252_youtube_content_pipeline.sql` (was fewer) |
| 4 | Agent topology | **CHANGED** | `tree/agents/` now has 18 importers (see DEPRECATION_CANDIDATES.md verdict); `tree/agent-protocol` + `forest/agent-protocol` coexist |
| 5 | AI provider topology | **CHANGED** | `seed/ai/` (KEEP, canonical) + `tree/ai-providers/` (MERGE target) still coexist; `seed/ai/script-generator.test.ts` is a real caller of `@/tree/byok/resolve-user-api-key` |
| 6 | Storage topology | **VERIFIED** | D1 primary + R2 cache (`sophia-ai-factory-opennext-cache`) + KV quota cache. Unchanged |
| 7 | Background-job topology | **VERIFIED** | Inngest-owned long-running workflows; `serve()` in `src/app/api/inngest/route.ts` registers 30 functions incl. `youtubeContentPipeline`, `performanceAggregationCron`, `patternDetectionCron`, `autoApplyMonitor`. Unchanged |
| 8 | Auth/billing topology | **VERIFIED** | Better Auth v1.6.2; NOWPayments primary, PayOS backup, Polar **banned**. Unchanged |
| 9 | Existing strengths | **VERIFIED** | 6744+ tests (752 vitest files under `src/`); 18 creative-economy API routes; circuit breaker on all external HTTP. Unchanged |
| 10 | Technical debt | **CHANGED** | `MarketSignal` duplicate export in `creative-domain.ts` (lines 158 + 627) — currently compiles, workaround required for new schema imports. New this run |
| 11 | Duplicated abstractions | **CHANGED** | Now documented: 4 KEEP / 6 MERGE / 3 DELETE-LATER / **0 UNKNOWN** (was 5 UNKNOWN). Plus 4 new duplicate groups not in the 2026-08-17 doc |
| 12 | Dangerous coupling | **VERIFIED** | Layer enforcement real via `eslint.config.mjs` `no-restricted-imports`. Unchanged |
| 13 | Missing abstractions | **CHANGED** | Canonical 15 `I*` interfaces + 13 events + errors + ids + schemas now being created in `src/seed/types/creative-economy/` this run (was: zero `I*` interface hits in `src/`) |
| 14 | Production risks | **VERIFIED** | Protected flows (Setup Wizard, Telegram @Sophia_Bbot, NOWPayments IPN) intact; deploy is CF-direct with SHA verification. Unchanged |
| 15 | Migration opportunities | **VERIFIED** | Strangler-pattern mandate intact; Phase 0 is additive-only (types + docs). Unchanged |
| 16 | What MUST NOT be rewritten | **VERIFIED** | Production features, protected flows, `src/lib/` compat layer. Unchanged |
| 17 | What should be deprecated | **CHANGED** | Verdicts now closed (was 5 UNKNOWN). See DEPRECATION_CANDIDATES.md |
| 18 | What should become reusable platform primitives | **VERIFIED** | seed primitives (`@/seed/types/result`, `failure-kind`, `circuit-breaker`, `get-user-tier`) are the reuse surface. Unchanged |

**Summary:** 6 sections changed, 12 verified. No section contradicted — the 2026-08-17 report remains accurate where it was right; the deltas are growth (more migrations, more tree modules, more tests) plus the new canonical-contracts work this run is doing.

---

## New facts not in the 2026-08-17 report

- **53 commits** since 2026-08-17, incl. `77eee2a4c` (Lumen port), `03963daba` (Creative Economy OS API routes), `9ea9ec407` (tree/agent-protocol), `4469a155e` (tree/learning), `96df57a3c` (seed/ai provider adapter), `458de9008` (migration relocation).
- **218 migrations**, newest `0252_youtube_content_pipeline.sql`.
- **`src/seed/types/`** = 51 files including `creative-domain.ts` (663 lines) and `missions.ts` (84 lines).
- **`src/tree/`** = 56 directories including creative-identity, creative-memory, mission, missions, agent-protocol, agents, ai-providers, autonomy, provenance, content-graph, ip-graph, performance, distribution, learning, memory, youtube-strategy.
- **752 vitest test files** under `src/`.
- **18 creative-economy API routes** under `src/app/api/creative-*/`.