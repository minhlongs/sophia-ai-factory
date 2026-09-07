# Project Changelog — Sophia AI Factory

> This file is an index. Full entries are split by quarter for faster loading.

**Last entry:** 2026-09-08 (SUPREME COMMAND #7 — fal.ai Image Adapter, Experimental)
**Current Production SHA:** 1df573d8 (deployed 2026-08-26; Phase 3 docs closeout — no commit/push by design)

---

## Quarter Index

| Quarter | Date Range | File |
|---------|-----------|------|
| 2026 Q3 | 2026-07-01 → present | [changelog/2026-Q3.md](changelog/2026-Q3.md) |
| 2026 Q2 | 2026-04-01 → 2026-06-30 | [changelog/2026-Q2.md](changelog/2026-Q2.md) |
| 2026 Q1 | 2026-01-15 → 2026-03-31 | [changelog/2026-Q1.md](changelog/2026-Q1.md) |
| 2025 archive | pre-2026 | [changelog/2025-archive.md](changelog/2025-archive.md) — no entries (project started Jan 2026) |

---

## Recent Entries (Q3 2026 — latest 5)

- **2026-09-08** — **SUPREME COMMAND #7 — fal.ai Image Adapter (Experimental).** New `FalImageProvider` class implementing `ImageGenerationProvider` interface with circuit breaker wrapping, BYOK for `FAL_KEY`, tier gating (BASIC/PREMIUM = fal-schnell only, ENTERPRISE+/MASTER = all models). Wired into `image-generate-action.ts`, `creative-studio/images/generate` route, and `creative-studio/images/[id]/status` route (provider guard returns cached D1 row without MuAPI polling). MuAPI path completely untouched. EXPERIMENTAL certification via `registerCertification`. 36 new tests (28 unit + 8 integration). Build clean, 8829 tests pass. Phase 7 (deploy) pending user approval.
- **2026-08-29** — **Sophia 2027 KILLER TEST — final gate GREEN.** Full acceptance flight verified end-to-end: `npm test` **8597 passed | 0 failed** (34 skipped, 10 todo, 833 files); `npx tsc --noEmit` 0 errors; `npm run lint` 0 errors in all 4 touched files. D4 mock-contract regression triage closed — 4 test files (`creative-mission-e2e`, `production-graph-runner`, `deterministic-mode`, `cancellation`) all patched identically for the new `persistAgentLearning` runner import (hoisted mock + factory + beforeEach). **No runner bug found; the only production delta is the D4 Creative Memory write-back (~10 lines in `production-graph-runner.ts`).** Protected flows (Setup Wizard, Telegram Bot, NOWPayments IPN) zero-diff. Zero new migrations. Ready for SHIP.
- **2026-08-27** — **Sophia 2027 Phase 3 — Autonomous Factory (docs closeout, Lane H).** Multi-agent production graph engine + 3 built-in templates + 3 graph agents; pause-and-await approval gates with first real sender of `agent.approval.requested` plus a `*/15` timeout cron safety net; mission-type autonomy policies with a fail-closed L2 resolver; exponential retry/backoff with terminal `RETRIES_EXHAUSTED` state and a wide-window rollback cron; bilingual System Health dashboard (6 KPIs + pending approvals + HarnessHealthCard) with 3 alert triggers. Migration `0257_production_factory.sql` (additive-only: `mission_type_policies`, `production_graphs`, `production_graph_runs`, `creative_missions.mission_type`). Inngest serve array 34 → 36. **144 scoped tests across 11 files** (graph repo 26, validate 11, templates 13, runner 16, approval gate 7, timeout cron 4, rollback cron 18, effective-autonomy 18, retry-backoff 16, dashboard-summary 9, dashboard actions 6) plus lane gates (schema/types 21 · autonomy 100/100 · approval 29 scoped / 128 broader · retry/resume 37 · graph engine 79 incl. existing validate · monitoring 23/23). Zero new `eslint-disable`; protected flows (Setup Wizard, Telegram Bot, NOWPayments IPN) zero-diff throughout. Docs: `docs/PRODUCTION_FACTORY.md` (NEW), `docs/architecture/AUTONOMY.md` (EXTEND — mission-type policies), `docs/roadmap/SOPHIA_2027_ROADMAP.md` Phase 3 section (all 6 deliverables marked complete with evidence), `docs/project-changelog.md` (this entry). No commit/push by design — central git-manager bucket follows.
- **2026-08-26** — Sophia 2027 Phase 2 Creative Intelligence: market signal ingestion (hourly cron, YouTube BYOK + Google Trends RSS), cross-channel trend detection + 7-day forecast, graph read API (`/api/graphs/[type]`, auth-gated), experiment schema debt closed (migration 0254) + AB engine bridge, heuristic performance scorer + backtest CLI, OpenRouter image adapter. Migrations 0254–0256. ~430 targeted tests green; full gates at Lane H.
- **2026-08-26** — Sophia 2027 Phase 1 domain primitives: CreativeIdentity injection, CreativeMemory flywheel, approval-event loop closure, MarketSignal dedupe, 34 content-graph tests. SHA 1df573d8.
- **2026-06-29** — Deploy Speedup + Health Worker Fix: Added `SKIP_SYMBOL_UPLOAD=1` to deploy script, skipping 3519-file R2 source map upload (saves ~30 min per deploy). Fixed health worker secret put non-fatal (already-set error). Production SHA b868840b verified live.
- **2026-06-22** — OpenTelemetry Staging Verified: Full OTel instrumentation deployed to staging with Honeycomb integration verified. Production rollout prepared with 1% samplerate. SOC 2 controls walkthrough documented, auditor engagement complete. Deploy guard multi-operator approvals now live. BYOK rotation framework prepared with versioning infrastructure.
- **2026-06-21** — Production Deploy: CF-direct deployment with latest fixes and verification. SHA 7c8dc4c5.
- **2026-06-15** — Parallel Execution Framework: Ultracode parallel agent orchestration implemented with 5-model distribution (opus-4-8, opus-4-7, sonnet-4-6, haiku-4-5, sonnet-4.5-lite). Automatic task routing based on complexity.
- **2026-06-14** — Stitch MCP Integration: Campaign Dashboard UI with Pencil design system integration. i18n support for VN+EN. Design overrides for missing pages.
- **2026-06-08** — Deploy Guard Finalization: Multi-operator approval workflows, admin UI, CI gate integration, comprehensive test coverage, and documentation complete.

See [changelog/2026-Q2.md](changelog/2026-Q2.md) for full history.
