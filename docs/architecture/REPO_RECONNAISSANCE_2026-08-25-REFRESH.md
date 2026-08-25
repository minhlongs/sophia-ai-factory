# Repository Reconnaissance Refresh — 2026-08-25

> **Delta against:** `docs/architecture/REPO_RECONNAISSANCE_2026-08-17.md` (289 lines, 18 sections — FROZEN, never edited) and `REPO_RECONNAISSANCE_2026-08-22-REFRESH.md`.
> **Method:** same per-section verify-then-delta as the 08-22 refresh: 18-row status table (VERIFIED vs CHANGED), every claim cites a path, command, or commit. Verified 2026-08-25.
> **HEAD:** `125c48e51f969c8c616941ef95c9105279b24622` on `main` (short `125c48e51`).
> **Commits since 08-22 base (`458de9008`):** **19** — `git log --oneline 458de9008..HEAD | wc -l` = 19.

---

## Section-by-section status (18/18)

| # | Section (2026-08-17) | Status | Evidence / change since 2026-08-22 |
|---|---|---|---|
| 1 | Current architecture | **CHANGED** | 4-layer model intact. Non-test `.ts/.tsx` counts (`find src/<layer> -type f ! -path '*__tests__*' ! -name '*.test.*'`): seed **448** / tree **486** / forest **522** / land **510**. `src/seed/types/creative-domain.ts` still 663 lines (`wc -l`). `src/seed/types/creative-economy/` contracts now exist: 10 files, 17 `export interface I*` (grep) |
| 2 | Runtime topology | **CHANGED** | CF Workers via OpenNext + `npm run deploy:full` unchanged; HEAD moved `458de9008` → `125c48e51` (19 commits). 08-17's `1bb074e70` is two refreshes stale |
| 3 | Data topology | **CHANGED** | Migrations **218 → 219** (`ls apps/sophia-ai-factory/migrations/*.sql \| wc -l` = 219); newest `0253_add_asset_id_to_performance_events.sql` (commit `11c55485a`) |
| 4 | Agent topology | **CHANGED** | Agent protocol SHIPPED: `executeAgent()` at `src/tree/agent-protocol/agent-executor.ts:72`; per-run BYOK registry + real budget (`553ee6284`); lifecycle authority consolidated (`6dd1401ed`); mission review console pages `src/app/[locale]/dashboard/missions/{page,[id]/page,[id]/rollback/page}.tsx` (`d5834a57b`); Inngest registers `agentMissionExecutor`, `agentApprovalHandler`, `agentRollbackCron` (`src/app/api/inngest/route.ts`) |
| 5 | AI provider topology | **CHANGED** | `tree/ai-providers/` formally DEPRECATED — 0 importers, removal eligible 2026-09-06 (`src/tree/ai-providers/index.ts` header, commit `47a4a80bd`); `seed/ai/` canonical. The 08-17/08-22 "coexist, MERGE target" state is resolved by deprecation |
| 6 | Storage topology | **VERIFIED** | D1 primary + R2 + KV unchanged; no storage commits in the 19 |
| 7 | Background-job topology | **CHANGED** | Duplicate Inngest clients merged into canonical seed client (`ba900e0c1`): `src/tree/inngest/client.ts` is now a `@deprecated` re-export shim (removable 2026-09-20), `src/forest/inngest/client.ts` a layer seam. `serve()` in `src/app/api/inngest/route.ts` now registers **34** functions (was 30 on 08-22), incl. `analyticsSync`, `learningVelocityCron`, `autoApplyMonitor`, `provenanceBridge` |
| 8 | Auth/billing topology | **VERIFIED** | Better Auth; NOWPayments primary, PayOS backup, Polar banned. IPN route `src/app/api/webhooks/nowpayments/route.ts` (227 lines) unchanged in the 19 |
| 9 | Existing strengths | **CHANGED** | Suite now **7985 passed / 1 failed** (pinned known-red) / 34 skipped / 10 todo; 783 passed test files of 785 (`npm test`, 2026-08-25). 782 `*.test.ts(x)` under `src/`. 08-17's "7,319 test files" and 08-22's "6744+ tests" both superseded |
| 10 | Technical debt | **CHANGED** | `MarketSignal` duplicate export persists: `src/seed/types/creative-domain.ts:158` has 2 declarations (grep). New verified debt: Telegram circuit-breaker gap + IPN replay freshness (see Carried-forward debt). One 08-17 debt item closed: `src/lib/` no longer exists (see §16) |
| 11 | Duplicated abstractions | **CHANGED** | Two of the five 08-17 groups resolved: AI Provider (tree copy deprecated, §5) and the Inngest client duplicate (merged, §7). Workflows/billing/agent-management groups remain |
| 12 | Dangerous coupling | **VERIFIED** | Protected flows (Setup Wizard, Telegram @Sophia_Bbot, NOWPayments IPN) untouched by all 19 commits (none touch those paths); layer enforcement via `eslint.config.mjs` `no-restricted-imports` intact |
| 13 | Missing abstractions | **CHANGED** | 6 of 12 now SHIPPED — see Abstraction status flips below. Remaining open: CreativeIdentity data-driven DNA (type exists at `creative-domain.ts:60`, no DNA engine), IP Graph, Content Graph, Performance Model interface, Distribution OS, canonical Domain Model |
| 14 | Production risks | **VERIFIED** | CF-direct deploy + SHA verification unchanged. Addendum: 1 pinned known-red test (`src/land/youtube/__tests__/actions.test.ts:322`) — pre-existing, deliberately untouched |
| 15 | Migration opportunities | **VERIFIED** | Strangler mandate validated in practice: agent-protocol strangler + memory/provenance adapters shipped via strangler pattern (`21caa1d89`), zero rewrites |
| 16 | What MUST NOT be rewritten | **CHANGED** | Items 1–11 stand, EXCEPT the `src/lib/` compat entry: directory does not exist at HEAD (`git ls-tree HEAD src/lib` empty); deleted by `b5a2b3eed` (2026-06-30, ancestor of `458de9008`); 0 `from '@/lib/'` imports in `src/` (grep). Root `CLAUDE.md:113` still claims it exists — stale doc, not code |
| 17 | What should be deprecated | **CHANGED** | Deprecations now executed with registry markers (`src/seed/types/deprecation-markers.ts`): `tree/ai-providers` (eligible 2026-09-06), `tree/inngest/client` (eligible 2026-09-20). "Implicit memory" deprecation advanced by typed `CreativeMemory` (`creative-domain.ts:115`) + adapters (`21caa1d89`) |
| 18 | Reusable platform primitives | **VERIFIED** | Seed primitives remain the reuse surface; new primitive added: `recordPerformanceEventIdempotent()` in `src/tree/performance/events.ts` (INSERT OR IGNORE, commit `5c21ccb1f`), reused by both revenue producers |

**Summary:** 12 sections changed, 6 verified. All changes are growth/consolidation (revenue ingestion, agent protocol activation, dedup merges); no protected flow touched.

---

## Abstraction status flips (08-17 "Missing" → SHIPPED)

| Abstraction | 08-17 status | 2026-08-25 evidence |
|---|---|---|
| Agent Protocol | Missing | `executeAgent()` `src/tree/agent-protocol/agent-executor.ts:72`; BYOK per-run registry `553ee6284`; lifecycle authority `6dd1401ed` |
| Creative Memory | Missing | `CreativeMemory` `creative-domain.ts:115`; `src/tree/creative-memory/` (4 files); adapters `21caa1d89`; API `src/app/api/creative-memory/route.ts` |
| Provenance | Partial (tree/) | `ProvenanceRecord` `creative-domain.ts:513`; `src/tree/provenance/` (3 files); `provenanceBridge` registered in `src/app/api/inngest/route.ts` |
| Mission Lifecycle | Missing | `src/tree/mission/` (6 files, tree-exclusive status authority per `6dd1401ed`); review console `d5834a57b`; retry/rollback repair `a75d35627` |
| Autonomy Levels | Missing | `AutonomyLevel = 0\|1\|2\|3\|4` `creative-domain.ts:373`; `src/tree/autonomy/` (3 files); approval gates enforced via `executeAgent` (`deprecation-markers.ts:79` cites AutonomyLevel gates) |
| Experiment Engine | Missing | `src/forest/ab/` (9 files: experiment-store, thumbnail-ab-runner, winner-picker…); migration `0250_ab_experiments_content_type.sql`; crons `thumbnailAbSelector`/`abWinnerPickerCron`/`experimentFeedbackCron` registered |

Canonical contracts: `src/seed/types/creative-economy/` barrel (`44f15d1dc`) — 17 `I*` interfaces, events, errors, branded ids, zod schemas.

---

## Revenue producers now exist — closes the "$0 dashboard" era

- **YouTube**: `src/land/analytics/revenue-ingestion.ts` writes `eventType: 'revenue'`, `channel: 'youtube'` (lines 89–90), deterministic id `rev_{userId}_{videoId}_{date}`, workspace-scoped, never throws (`5c21ccb1f`; cron integration tests `9267f0c40`).
- **TikTok**: `src/land/analytics/tiktok-revenue-ingestion.ts` bridges `conversion_events` → `performance_events` with `eventType: 'conversion'`, `channel: 'tiktok-shop'`, id `conv_{conversionEventId}` (`125c48e51`).
- **Dashboard consumes both**: `src/land/creative-economy/dashboard-summary.ts:67` sums `event_type IN ('revenue','conversion','impression')`; `asset-performance.ts:72` sums `('revenue','conversion')`. Revenue card stops reading $0 once cron writes land (feature smoke pending next `analyticsSync` run per `.orchestrate/latest/execution.md` escrow).
- Schema support: migration `0253_add_asset_id_to_performance_events.sql` (`11c55485a`).
- Bilingual CEO dashboard shipped: `src/app/[locale]/dashboard/creative-economy/` (page + 5 section components, `9227f197e`).

---

## New facts not in prior reports

1. **19 commits** `458de9008..HEAD` — headline: `125c48e51` (TikTok bridge), `9267f0c40` (cron tests), `5c21ccb1f` (YouTube revenue), `9227f197e` (dashboard OBS-2), `11c55485a` (schema alignment), `f22ef230f` (learning-loop wiring), `a75d35627` (rollback cron repair), `d5834a57b` (mission console), `553ee6284` (BYOK registry), `6dd1401ed` (lifecycle authority), `ba900e0c1` (Inngest merge), `47a4a80bd` (ai-providers deprecation), `21caa1d89` (Creative Foundation), `44f15d1dc` (contracts barrel).
2. **Suite**: 7985 passed / 1 failed (pinned C1) / 785 test files (`npm test` from `apps/sophia-ai-factory/`, 2026-08-25).
3. **Layer counts**: seed 448 / tree 486 / forest 522 / land 510 (non-test files).
4. **Inngest**: 34 registered functions (was 30 on 08-22).
5. **Doc divergence (P0 inventory)**: `diff -rq docs/ apps/sophia-ai-factory/docs/` → 31 pairs DIFFER, 120 root-only, 133 app-only. Root constitution `docs/strategy/SOPHIA_2027_CONSTITUTION.md` = **652 lines** (`wc -l`), bilingual; app copy = 231 lines EN-only with different North Star term. Canonical strategy docs = repo-root `docs/` (decision recorded in `.orchestrate/latest/execution.md`).
6. **Learning loop**: dead performance pipeline wired end-to-end (`f22ef230f`), schema aligned to prod D1 (`11c55485a`), `autoApplyMonitor` registered.

---

## Carried-forward debt (verified, still open)

| Debt | Evidence |
|---|---|
| Telegram circuit-breaker gap | `src/tree/telegram/telegram-client.ts` wraps fetch with `shouldAllowRequest/recordSuccess/recordFailure` (lines 1, 7, 34–40), but `telegram-bot-harness-handlers.ts:22` and `telegram-handover-notifier.ts:54` call raw `fetch()` with no breaker |
| IPN replay protection (freshness) | Signature verified (`parseIpnWebhook` → `sdk.parseWebhook(..., { verify: true })`, `src/tree/clients/nowpayments-client.ts:219`) and event-level idempotency exists (INSERT ON CONFLICT DO NOTHING on `payment_events.event_id`, `route.ts:145-151`); but `route.ts` has NO timestamp/nonce freshness check — an old-but-validly-signed IPN is accepted and only deduped at event level |
| `MarketSignal` duplicate export | `src/seed/types/creative-domain.ts:158` — 2 declarations of `export interface MarketSignal` (grep); compiles, but blocks clean schema imports |
| ESLint baseline | `npm run lint` 2026-08-25: **11 errors / 335 warnings**, all pre-existing outside touched paths; suppression freeze per global rules |
| Pinned known-red C1 | `src/land/youtube/__tests__/actions.test.ts:322` — 1 failing test, pre-existing deploy base, deliberately untouched |
| `src/lib/` compat zone (doc-only) | Code resolved: dir deleted (`b5a2b3eed`), 0 `@/lib` imports. Doc stale: root `CLAUDE.md:113` still says `src/lib/` exists |
| Root↔app doc divergence | 31 differing pairs (P0 inventory); only recon + constitution reconciled this slice, rest inventory-only (YAGNI) |

---

## Contradictions with the 2026-08-17 original (recorded here; original stays frozen)

1. **§3 "17 migrations"** → actual **219** (`ls migrations/*.sql | wc -l`).
2. **§4 "No standardized agent protocol exists"** → protocol shipped: `executeAgent()` `src/tree/agent-protocol/agent-executor.ts:72`.
3. **§9/§14 "7,319 test files"** → 7985 tests passed across 785 test files (`npm test`).
4. **§16 `src/lib/` compat layer must not be rewritten** → `src/lib/` no longer exists at HEAD (deleted `b5a2b3eed`, before the 08-22 base); entry is moot.
5. **§13 Missing Abstractions table** → 6 of 12 rows now SHIPPED (flips table above).
6. **08-22 §7 "registers 30 functions"** → now **34** (`src/app/api/inngest/route.ts`).
7. **Plan-era claim "root constitution = 653 lines"** → verified **652** (`wc -l docs/strategy/SOPHIA_2027_CONSTITUTION.md`).

---

*Generated 2026-08-25 by docs-manager (P1, Sophia 2027 Transformation Slice 1). All commands run from `apps/sophia-ai-factory/` unless noted. Next refresh trigger: any slice that changes layer counts, migrations, or abstraction status.*
