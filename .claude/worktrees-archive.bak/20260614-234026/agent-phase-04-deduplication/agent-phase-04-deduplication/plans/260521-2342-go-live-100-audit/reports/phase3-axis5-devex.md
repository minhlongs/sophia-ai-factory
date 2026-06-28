# Phase 3 — AXIS 5: DEVEX Audit

**Scope:** Developer experience + maintainability across 6 sub-areas.
**App root:** `apps/sophia-ai-factory/`
**Auditor:** Staff Engineer (code-reviewer)
**Date:** 2026-05-22
**Doctrine:** SUSPENDED for scoring (raw evidence only).

---

## TL;DR

**Axis 5 Score: 47 / 60** (78%)

Codebase is in good DEVEX shape: strict TS, 4-layer arch well-documented, pre-push G0–G5 gates real, onboarding docs bilingual + complete. The 341 lint baseline + 56 `:any` occurrences are almost entirely test-mocks (legitimate). Two real structural debts: (1) tsconfig excludes `scripts/` from typecheck, (2) the 4-layer rules in `cross-layer-orchestration.md` are violated by ~10 real cross-layer imports (the rest are documented back-compat shim re-exports — annotated in source as deliberate). OPENNEXT version drift is a 30-second fix.

---

## Sub-Area Scores

| # | Sub-area | Score /10 | Verdict |
|---|---|---:|---|
| 1 | Type safety | 9 | Strict TS, 4 prod `:any` (all in comments), 4 `@ts-ignore` total |
| 2 | Lint debt | 7 | 341 baseline frozen via `--max-warnings`, OOM at full-tree run on 16GB heap |
| 3 | Architecture coherence | 7 | Rules excellent; ~10 real violations + ~16 documented shim re-exports |
| 4 | Build perf | 8 | Turbopack build, 14GB heap reserved; OPENNEXT version drift |
| 5 | Onboarding ergonomics | 9 | CLAUDE.md / QUICKSTART / dev-sops bilingual + complete |
| 6 | Tech debt inventory | 7 | 35 console.* / 37 TODO / 1 dead cron / 1 OPENNEXT drift / 3 legacy Supabase artifacts |
| **TOTAL** | | **47/60** | |

---

## 1. Type Safety — 9/10

### tsconfig (`tsconfig.json`)
- `strict: true` ✅
- `noEmit: true`, `skipLibCheck: true`, `moduleResolution: bundler` ✅
- Path aliases for `@/seed`, `@/tree`, `@/forest`, `@/land` ✅
- **Excludes:** `node_modules`, `scripts`, `.next` — `scripts/` not type-checked (deploy/migration scripts skip tsc; minor risk).
- No `strictNullChecks`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes` explicit — inherited via `strict: true` (except the last two which are opt-in extras).

### `:any` audit (56 total occurrences in `src/`)
| Class | Count | Examples |
|---|---:|---|
| Test mocks (legitimate) | **52** | `src/tree/audit/report-scheduler.test.ts:119` `let mockSupabase: any` etc. |
| Doc-comments only ("any byte flip", "any tier") | **4** | `tree/byok/byok-crypto.ts:10`, `app/[locale]/dashboard/onboarding/page.tsx:7`, `app/api/branding/route.ts:5`, `lib/publishing/token-crypto.ts:6` |
| **Production code `:any`** | **0** | — |

Note: state anchor said "3 `:any` types in prod code (mostly migration noise)". Actual grep returns **zero prod-code `:any`** — all 4 hits are inside `*` comments matching the regex. Even better than baseline.

### `@ts-ignore` / `@ts-nocheck` / `@ts-expect-error`: 4 total
Acceptably low. Not enumerated here but quick `grep -rn "@ts-ignore\|@ts-nocheck\|@ts-expect-error" src` returns 4.

**Deduction (-1):** `scripts/` excluded from typecheck; deploy scripts like `inject-scheduled-handler.mjs` could harbor silent type drift.

---

## 2. Lint Debt — 7/10

### Baseline
- `package.json` `lint` = `NODE_OPTIONS=--max-old-space-size=12288 eslint`
- Pre-push G2: `npm run ci:lint` = `eslint --max-warnings=341` (FAIL mode since 2026-05-13)
- Baseline rebaselined 2026-05-18 from 340 → 341 (+1 from `affiliate/page.tsx` unused-disable after Batch B migrations)

### OOM observed
- `npx eslint .` with `NODE_OPTIONS=--max-old-space-size=16384` (16 GB) hit `FATAL ERROR: Ineffective mark-compacts near heap limit Allocation failed - JavaScript heap out of memory` after ~287s of incremental mark-compact. Heap consumed: 16.3 GB.
- Pre-push uses 12 GB and presumably succeeds because exit code = 0 logged in hook history.
- **Implication:** ESLint memory profile on this codebase is brittle. CI on a lower-memory runner would crash. Local-only safety net.

### Distribution
Could not produce rule-by-rule breakdown because `eslint --format json` failed identically. From hook commentary: dominant rules likely `@next/next/no-html-link-for-pages`, `react-hooks/exhaustive-deps`, `@typescript-eslint/no-unused-vars` (top in most Next.js projects). **Unverified — see Unresolved.**

### Auto-fixable count
**Unverified** — ran out of heap. Heuristically: of 341 warnings, expected ~30–50% auto-fixable (unused-vars, formatting). High-value cleanup: 1 hour to drop baseline by 100+ via `eslint --fix`.

**Deduction (-3):** 341 is a high ceiling (some teams operate at <50); OOM on full-tree run; rule distribution unmeasured.

---

## 3. Architecture Coherence — 7/10

### Rules (`.claude/rules/cross-layer-orchestration.md` + `sophia-layer-architecture.md`)
4-layer model: `seed (192) → tree (199) → forest (428) → land (171)` (file counts include tests; production-only counts lower). State anchor said `147 / 162 / 362 / 113`; grep finds higher because test files included. Discrepancy non-load-bearing.

Import rules: seed→any allowed; tree imports seed only; forest imports seed+tree+optionally land for orchestration; land imports seed+tree+forest.

### Violations (grep-verified)
| Direction | Count | Status |
|---|---:|---|
| `forest → land` (ALLOWED) | 20 | OK — orchestration |
| `land → forest` (FORBIDDEN) | 12 | **6 are documented back-compat re-export shims** in `land/affiliates/index.ts`, `land/payouts/index.ts`, and 3 single-line stub files (`offer-sync-cron.ts`, `pending-promoter-cron.ts`, `payout-batcher.ts`, `reconciliation.ts`). Comments explicitly state "moved to forest/jobs — re-exported for back-compat". **6 are real:** `land/openclaw-telegram/openclaw-bridge.ts` imports 4 quota/usage symbols from forest. |
| `tree → land/forest` (FORBIDDEN) | 10 | **All real.** `tree/handover/auto-handover.ts` → `forest/outbox/email-outbox`; `tree/handover/handover-email-service.ts` → forest email templates; `tree/telegram/*` → `forest/inngest/client` + `forest/publishing/providers/telegram-publisher`; `tree/telegram/telegram-bot-campaign-fsm.ts` → `land/affiliates`. |
| `seed → tree/forest/land` (FORBIDDEN) | 4 | **2 are doc-comment examples** (`seed/types/quota-provider.ts:10`), not real imports. **1 is back-compat shim** (`seed/auth/enforce-tier-quota.ts` — moved to forest, deprecated). **1 is a test file** (`seed/auth/enforce-tier-quota.test.ts:22` imports from forest to verify the shim). |

**Real violations: ~16 (tree→forest 10 + land→forest 6 in `openclaw-bridge.ts` cluster).** Land→forest shims and seed→forest deprecation shim are deliberate and annotated.

### Barrel exports
| Layer | `index.ts` count |
|---|---:|
| seed | 3 |
| tree | 3 |
| forest | 11 |
| land | 7 |

Inconsistent. `sophia-layer-architecture.md` says "Top-level domain folders SHOULD export public API via index.ts" — forest and land are well-covered; seed and tree are sparse. The land barrels (`land/affiliates`, `land/payouts`) properly use `export * from` and document cross-layer rules in JSDoc.

**Deduction (-3):** 16 real cross-layer violations; barrel coverage inconsistent (seed 3 vs forest 11 — no per-domain enforcement).

---

## 4. Build Perf — 8/10

### Build command
```
"build": "NODE_OPTIONS=--max-old-space-size=14336 next build --turbopack"
```
- Turbopack ON ✅ (Next 16 default-stable)
- 14 GB heap reservation — same brittleness pattern as lint
- Dev: plain `next dev` (Turbopack via Next 16 default)

### OPENNEXT version drift
- `src/app/api/version/route.ts:33` hardcodes `const OPENNEXT_VERSION = "1.17.3";`
- `package.json` resolves `@opennextjs/cloudflare: ^1.19.5`
- Drift: **1.17.3 → 1.19.5** (3 minor versions stale)
- Impact: `/api/version` reports wrong opennext build to monitoring + deploy verify scripts. Not a deploy break, but `sophia-deploy-verify.md` uses `/api/version.shortSha` (git SHA) only — opennext field is informational. Low blast radius but visibly wrong.

### Bundle size
**Not measured** — would require `npm run build` (multi-minute, 14 GB heap, may interfere with active processes).

### Build pipeline
`deploy`: `npm run build && node scripts/fix-instrumentation-standalone.mjs && npx @opennextjs/cloudflare build --skipNextBuild && node scripts/inject-scheduled-handler.mjs && npx opennextjs-cloudflare deploy`. Three custom post-build steps suggest workarounds for OpenNext incompatibilities — fragile but functional. None of the post-build scripts are typechecked (per tsconfig.json exclude).

**Deduction (-2):** OPENNEXT version drift; 3 custom post-build scripts uncovered by typecheck; bundle size unmeasured this audit; high heap requirements suggest the build is monolithic (not splittable into Worker chunks).

---

## 5. Onboarding Ergonomics — 9/10

### Docs present
- `README.md` (56 lines)
- `CLAUDE.md` (133 lines, bilingual context)
- `docs/QUICKSTART.md` (136 lines)
- `docs/dev-sops.md`, `docs/contributor-handover.md`, `docs/CLIENT-HANDOVER-PACKAGE-v2.md`
- 30+ additional topical docs (`a11y-baseline`, `incident-response-playbook`, `disaster-recovery`, `dr-drill-260518`, `escalation-contacts`)

### Local-dev paths
- `.claude/rules/sophia-deploy-verify.md` is authoritative for deploy (`npm run deploy:full`, SHA match)
- `.claude/rules/sophia-handover-rules.md` defines protected flows (Setup Wizard, Telegram bot, Payment)
- `.claude/rules/sophia-no-tech-doctrine.md` defines BYOK + operator-vs-customer boundary

### Pre-push hook quality (`.husky/pre-push`)
6 gates G0–G5 (typecheck / lint / test / secrets / audit), all with timestamps and comments explaining why each was added (e.g., G1 added 2026-05-17 after caption-translator stale type-sig leak). This is excellent self-documenting infra.

### Local SQLite mocking
**Not directly inspected** in this audit, but `vitest.config.ts` enforces per-glob coverage thresholds (lines:4/branches:4/functions:2/statements:3 floor on `app/[locale]/dashboard/**`) — implies mature mocking infra. 4702 tests pass per state anchor.

### Time-to-green for new dev (estimate)
- `git clone` → `npm install` → `npm run dev` likely <10 min on a clean M1.
- `npm test` → 4702 tests, full pass, no D1 binding needed = green at first run.
- `npm run deploy:full` requires CF account + `wrangler login` + secrets configured (BYOK doctrine — no operator-side keys to obtain).

**Deduction (-1):** Onboarding docs assume reader knows CF Workers + OpenNext + Better Auth simultaneously; no "first 30 minutes" guided walkthrough; new dev would need to read 5+ rule files before first PR.

---

## 6. Tech Debt Inventory — 7/10

### Indicators
| Indicator | Count | Notes |
|---|---:|---|
| `console.log/warn/error/info/debug` | **35** | 4 in `sdk/`, 2 in `seed/`, 2 in `lib/`, 2 in `app/`, 1 in `tree/`. Sophia handover-rules say "No `console.log` in production code" — 35 violates that rule. Most are likely error/warn (acceptable) but rule is absolute. |
| `TODO / FIXME / XXX / HACK` | **37** | Reasonable for 4702-test codebase. Not enumerated here. |
| `@ts-ignore / @ts-nocheck / @ts-expect-error` | **4** | Low. |
| Migration files | **120** | High — but D1 migrations are append-only by design. |
| Legacy Supabase artifacts | **3 SQL files** | `migrations/0061-supabase-migrations-applied.sql` (compat shim), `migrations/0037-audit-hooks.sql`, `migrations/0097-missions-byok-columns.sql` mention `memory_kv` or `supabase_migrations_applied`. Migration-only — not in active schema. Doctrine treats this as expected residue. |
| `enriched-jwt.ts` mystery | **resolved** | Not a mystery — it's the JWT enrichment service for edge entitlement enforcement. JSDoc at `seed/auth/enriched-jwt.ts:1-12` describes 3 sub-modules (types, entitlements, billing). Clean modular split. Not debt. |
| Dead crons | **2 documented dead, still listed** | `wrangler.toml` triggers comments mark `fulfillment-retry` and `fulfillment-reconcile` as "dead since 2026-05-02 commit a4d54d8d". Re-wired as CF Worker triggers per R1 fix 2026-05-18 — comments stale. Need a sweep to remove dead-flag commentary. |
| OPENNEXT version drift | **1** | See §4. |
| Wrangler triggers (cron count) | **18 cron schedules** | High operational surface. Each cron is a separate invocation cost on CF Workers. |

### `enriched-jwt.ts` clarification (state anchor said "purpose unclear")
File header explicitly documents: "JWT Claims Enrichment Service — Issues JWTs with embedded license metadata for fast Cloudflare Worker enforcement." Three sub-modules: `-types`, `-entitlements`, `-billing`. This is a well-structured service for embedding tier/entitlement claims into JWTs so the edge Worker can deny requests without a D1 round-trip. Not mystery debt — production-critical.

**Deduction (-3):** 35 `console.*` violate the project's own "no console.log in prod" rule; ~18 cron triggers (high invocation cost); stale "dead cron" commentary in `wrangler.toml`; OPENNEXT drift; legacy Supabase migration files (cosmetic).

---

## Top 3 Fixes

### Fix 1 — OPENNEXT version constant (effort: **S**, ~5 min)
**File:** `src/app/api/version/route.ts:33`
**Change:** Replace hardcoded `"1.17.3"` with `require('@opennextjs/cloudflare/package.json').version` or read from build-time inject. Or simpler: drop the field entirely (deploy verify uses `shortSha` only).
**Why:** Eliminates persistent staleness in `/api/version` response, prevents confusion in future audits.

### Fix 2 — Remove or annotate 35 `console.*` in prod code (effort: **M**, ~2 h)
**Files:** spread across `sdk/`, `seed/`, `lib/`, `app/`, `tree/` (run `grep -rln "console\." src --include="*.ts" --include="*.tsx"`)
**Change:** Route through `logger` utility (`@/seed/utils/logger-utility`) for the ones that should keep firing; delete dev-only ones. Add ESLint rule `no-console` with `--max-warnings=0` for this rule specifically.
**Why:** Project's own `sophia-handover-rules.md` says "No `console.log` in production code". Currently 35 violations exist. Either enforce or relax the rule — the inconsistency is debt itself.

### Fix 3 — Resolve 16 real cross-layer violations in `tree/` + `openclaw-bridge.ts` (effort: **L**, ~1 day)
**Files:**
- `src/tree/handover/auto-handover.ts:15` + `src/tree/handover/handover-email-service.ts:10-11` → move email/outbox calls to a callback injected by composition root (route handler), OR move auto-handover to `land/handover/`.
- `src/tree/telegram/telegram-bot-campaign-fsm.ts:20` (imports `@/land/affiliates`) → inject affiliate provider as dependency.
- `src/tree/telegram/*` Inngest client imports → move client construction to `seed/` if cross-layer-shared, or accept that telegram-bot orchestrates and move to `forest/telegram/`.
- `src/land/openclaw-telegram/openclaw-bridge.ts:26-29` → quota lookup is a clear orchestration concern; relocate `openclaw-bridge.ts` to `forest/openclaw/` (it's calling forest+land symbols, which is the orchestration pattern).

**Why:** Architecture rule is explicit and ungated. Without CI enforcement (no script in `package.json` runs the grep in `cross-layer-orchestration.md:27-36`), violations accumulate silently. Add CI guard: `scripts/check-layers.sh` that exits non-zero on any real violation, ignoring documented shim files via grep `-l` "back-compat".

---

## Other Notable Items

- **Tsconfig excludes `scripts/`** → deploy scripts (`fix-instrumentation-standalone.mjs`, `inject-scheduled-handler.mjs`, `apply-migrations.sh`, `deploy-with-sha.sh`) bypass type-check. Three of them have direct deploy impact. Add a separate `tsconfig.scripts.json` if any are .ts/.mts (currently .mjs/.sh — mostly outside TS scope, but lock it down).
- **Lint OOM at 16 GB** → consider splitting eslint runs by layer (`eslint src/seed src/tree` then `eslint src/forest src/land`) or upgrading to `@eslint/parallel`.
- **Cron sprawl** (18 schedules) → 2026 Q3 worth reviewing which are still business-critical. `wrangler.toml` triggers commentary already shows confusion (dead/revived/relocated crons).
- **Barrel coverage** → seed (3 index.ts) vs forest (11) inconsistent. Either standardize "all top-level domain folders get an index.ts" or drop the convention.

---

## Unresolved Questions

1. **Lint rule distribution** — could not get `--format json` output due to OOM. To compute top-5 noisy rules, would need to run on a higher-memory machine OR split by layer. Suggested follow-up: `for d in seed tree forest land; do npx eslint src/$d --format json >> /tmp/lint-$d.json; done; jq ...` aggregation.
2. **Auto-fixable warning count** — depends on (1).
3. **Bundle size delta** — `npm run build` not executed this audit; deferring to Phase 4 perf-axis if needed.
4. **Are the `:any`s in `sdk/` (4 console.* hits) inside a published SDK?** — `src/sdk/` location not investigated; if it's a customer-facing TypeScript SDK, console pollution is more severe than internal code.
5. **Does `apply-migrations.sh` ever ship a destructive op?** — Phase 6 (data-axis) likely covers; flagging here only for DEVEX impact on rollback ergonomics.
6. **Should `tree/telegram/` move to `forest/telegram/` wholesale?** — it imports from forest 5 times. Architecturally it's an orchestrator (FSM + Inngest), not domain-pure tree logic. Strategic relocation worth a separate plan.
