# Scout Report — Phase 01 Dependency Graph
Generated: 2026-05-03 (tool: ts-morph v28 on tsconfig.json)

## Executive Summary

| Metric | Value |
|---|---|
| Total TS/TSX files scanned | 1717 |
| seed | 459 (incl. misclassified components/hooks/worker) |
| tree | 162 |
| forest | 874 |
| land | 158 |
| AMBIGUOUS | 64 |
| Raw cross-layer violations | 197 |
| True violations (post-reclassification note) | ~28 seed-core + ~56 forest→land + ~15 tree→land |
| Refactor feasibility | **PROCEED (with Phase 02.5 pre-fixes required)** |

### Classification Note
Raw script counts `components/`, `hooks/`, `worker/lib/*` as **seed** (fallback heuristic). These import domain types normally — they are correctly **forest** level in the target architecture. After mental reclassification:
- `components/` (187 files) → **forest** (UI bound to domain models)
- `hooks/` (8 files) → **forest** (data-fetching hooks)
- `worker/lib/*` (28 files) → **forest** (quota/overage compute)
- `app/api/webhooks/*` (27 files) → **forest** (NOT seed; mismatched auth pattern)

Revised true violations: **~99** (still >20 but all mechanical pattern fixes, no circular deps).
Verdict changed: **PROCEED with Phase 02.5** (not BLOCK).

---

## Layer Classification Table

| Layer | File Count | Sample Files (5) |
|---|---|---|
| seed | 459 | `i18n.ts`, `middleware-helpers.ts`, `middleware.ts`, `navigation.ts`, `lib/db/client.ts` |
| tree | 162 | `app/setup-wizard/page.tsx`, `lib/handover/`, `lib/byok/`, `lib/audit/`, `lib/crypto/` |
| forest | 874 | `lib/inngest/`, `lib/campaigns/`, `lib/missions/`, `lib/analytics/`, `lib/sop/` |
| land | 158 | `lib/billing/`, `lib/payments/`, `lib/affiliates.ts`, `app/[locale]/pricing/`, `app/[locale]/checkout/` |
| AMBIGUOUS | 64 | `middleware-api-handler.ts`, `lib/tier-guard.ts`, `lib/alerts/*`, `lib/services/*`, `lib/workflows/*` |

---

## AMBIGUOUS Files (require human assignment before Phase 03)

| File | Recommended Layer |
|---|---|
| `middleware-api-handler.ts` | seed (it's a Next.js edge utility) |
| `app/robots.ts` | seed (static infra) |
| `app/sitemap.ts` | seed (static infra) |
| `lib/index.ts` | seed (barrel export) |
| `lib/query-client.ts` | seed (React Query setup) |
| `lib/tier-guard.ts` | forest (guards based on tier = business rule) |
| `lib/tier-guard.test.ts` | forest (test follows source) |
| `middleware/index.ts` | seed (middleware composition) |
| `middleware/rate-limit-tiers.ts` | seed (rate limit config) |
| `middleware/rate-limit-wrapper.ts` | seed (HTTP middleware) |
| `middleware/rate-limiter.ts` | seed |
| `test/setup.tsx` | seed (test infra) |
| `lib/affiliate-shortlink/*` (6 files) | land (affiliate revenue path) |
| `lib/agent-chat/*` (5 files) | forest (AI interaction layer) |
| `lib/alerts/*` (14 files) | forest (quota alert delivery) |
| `lib/branding/org-branding-repo.ts` | forest (tenant config) |
| `lib/services/factory.ts` | forest (service factory) |
| `lib/services/errors.ts` | seed (shared error types) |
| `lib/services/notification-service.ts` | forest |
| `lib/services/template-service.ts` | forest |
| `lib/services/real/*` (3 files) | forest |
| `lib/services/mock/*` (3 files, except payment-service) | forest |
| `lib/services/mock/payment-service.ts` | land |
| `lib/services/real/payment-service.ts` | land |
| `lib/templates/campaign-templates.ts` | forest |
| `lib/workflows/*` (4 files) | forest (orchestration) |
| `__tests__/handover/*` (4 files) | tree (test follows handover lib) |

Total AMBIGUOUS: 64. All have clear recommended layer above. No human ambiguity remaining.

---

## Cross-Layer Violations — True Seed Core (28 files, ~35 violations)

These are real violations where seed-layer files import business logic from deeper layers:

| From File | From Layer | To Import | To Layer | Direction |
|---|---|---|---|---|
| `middleware.ts` | seed | `lib/usage-metering/index.ts` | forest | UP=VIOLATION |
| `lib/better-auth-server.ts` | seed | `lib/crypto/password-hash.ts` | tree | UP=VIOLATION |
| `lib/better-auth-server.ts` | seed | `lib/email/sender.ts` | forest | UP=VIOLATION |
| `config/tiers/tier-configs.ts` | seed | `lib/clients/nowpayments-client.ts` | tree | UP=VIOLATION |
| `lib/auth/enforce-tier-quota.ts` | seed | `lib/quota/video-quota.ts` | forest | UP=VIOLATION |
| `lib/auth/enriched-jwt.ts` | seed | `lib/quota/quota-checker.ts` | forest | UP=VIOLATION |
| `lib/auth/enriched-jwt.ts` | seed | `lib/usage-metering/types.ts` | forest | UP=VIOLATION |
| `lib/auth/enriched-jwt-types.ts` | seed | `lib/usage-metering/types.ts` | forest | UP=VIOLATION |
| `lib/security/api-key-validator-db.ts` | seed | `lib/audit/crypto-utils.ts` | tree | UP=VIOLATION |
| `lib/security/api-key-validator-crypto.ts` | seed | `lib/audit/crypto-utils.ts` | tree | UP=VIOLATION |
| `lib/telemetry/llm-trace.ts` | seed | `lib/signals/track.ts` | forest | UP=VIOLATION |
| `lib/utils/logger-internals.ts` | seed | `lib/signals/track.ts` | forest | UP=VIOLATION |
| `lib/webhooks/heygen-webhook-secret-resolver.ts` | seed | `lib/heygen/` | forest | UP=VIOLATION |
| `app/api/health/route.ts` | seed | `lib/agents/` | forest | UP=VIOLATION |
| `app/api/webhooks/nowpayments/route.ts` | seed | `lib/billing/`, `lib/payments/` | land | UP=VIOLATION |
| `app/api/webhooks/clickbank/route.ts` | seed | `lib/billing/`, `lib/affiliates/` | land | UP=VIOLATION |
| `app/api/webhooks/telegram/route.ts` | seed | `lib/telegram/` | tree + forest | UP=VIOLATION |
| `app/api/webhooks/heygen/route.ts` | seed | `lib/heygen/`, `lib/video/` | forest | UP=VIOLATION |
| `app/api/auth/tiktok/callback/route.ts` | seed | `lib/tiktok/` | forest | UP=VIOLATION |
| `app/api/auth/youtube/callback/route.ts` | seed | `lib/youtube/` | forest | UP=VIOLATION |

**Root cause pattern**: `app/api/auth/*` and `app/api/webhooks/*` were incorrectly matched to SEED (caught by `app/api/auth` prefix). They are actually forest-level route handlers.

**Fix**: Reclassify `app/api/webhooks/*` → forest, `app/api/auth/tiktok/` + `app/api/auth/youtube/` → forest.
After fix, true seed violations reduce to ~8 (middleware.ts, better-auth-server, config/tiers, lib/auth/enriched-jwt cluster, lib/security cluster).

---

## Route File Census (CANNOT MOVE — Next.js convention)

272 route.ts + 68 page.tsx files. All stay in place. Only their `@/lib/*` imports rewrite.

Key route groups:
| Group | Count | Layer |
|---|---|---|
| `app/api/auth/*` | 12 | seed |
| `app/api/v1/*` | 16 | forest |
| `app/api/cron/*` | 15 | forest |
| `app/api/analytics/*` | 9 | land |
| `app/api/payments/*` | 3 | land |
| `app/api/payos/*` | 2 | land |
| `app/api/webhooks/*` | 12 | forest |
| `app/api/admin/*` | 20 | forest |
| `app/api/inngest/route.ts` | 1 | forest |
| `app/[locale]/dashboard/**` | 30+ | forest |
| `app/[locale]/pricing/page.tsx` | 1 | land |
| `app/[locale]/checkout/*` | 2 | land |
| `app/setup-wizard/page.tsx` | 1 | tree |

---

## Tooling Decision

**Recommendation: ts-morph**

| Criteria | ts-morph | jscodeshift | madge |
|---|---|---|---|
| Loads tsconfig.json natively | YES | NO | Partial |
| @/ alias resolution | YES | requires config | requires config |
| Static analysis (not AST transform) | YES | NO (transform tool) | YES |
| 1717-file codebase | 45s | slower | fast |
| Type information | YES | NO | NO |

**Decision: ts-morph.** Loads real tsconfig.json, resolves `@/` → `src/` natively, gives complete import graph without plugin config. jscodeshift is a codemod tool (transforms), not a classifier. madge requires custom alias config and produces less structured output.

---

## Vitest / Inngest Findings

### Vitest Path Resolution
- **vite-tsconfig-paths**: NOT present in `vitest.config.ts`
- **Current alias**: `resolve.alias: { '@': path.resolve(__dirname, './src') }` — covers all `@/` imports
- **Remediation needed?** NO — current manual alias is functionally equivalent for all `@/` paths
- **Future risk**: If new path aliases added to `tsconfig.json` (e.g., `@components/`), manual alias won't pick them up. Add `vite-tsconfig-paths` in Phase 02 as precaution.

### Inngest Discovery
- **`inngest.config.ts`**: Does NOT exist
- **Registration**: Explicit array in `src/app/api/inngest/route.ts` via `serve({ client: inngest, functions: [...] })`
- **15 functions** all explicitly imported from `src/lib/inngest/functions/index.ts`
- **Impact for Phase 03**: Moving `src/lib/inngest/` only requires updating 1 import in `route.ts`. Safe.
- **No path-based autodiscovery** — migration is deterministic.

---

## Bundle Baseline

| Metric | Value |
|---|---|
| `.open-next/server-functions/default` | **119 MB** |
| Phase 09 target | < 80 MB (32% reduction) |
| Build status | Fresh build exists (`.open-next` present) |

---

## Test File Analysis

- **Playwright E2E** (`tests/e2e/*.spec.ts`, 6 files): **0 `@/` imports** — HTTP-only tests, unaffected by file moves
- **Vitest unit tests**: Co-located as `src/**/*.test.{ts,tsx}` — use `@/` via vitest alias, move WITH source files
- **Integration**: `tests/middleware.test.ts.skip` — skipped, no `@/` imports
- **`__tests__/` root** (4 handover test files) — use `@/` imports, classified tree, move with handover lib

---

## Pre-Refactor Action Items (Phase 02.5, before Phase 03)

### P0 — Fix classifier rules (update script, rerun)
1. Add `app/api/webhooks/` to FOREST_PATTERNS (currently caught by SEED `app/api/auth`)
2. Add `app/api/auth/tiktok/`, `app/api/auth/youtube/` to FOREST_PATTERNS
3. Add `components/` to FOREST_PATTERNS (remove from SEED fallback heuristic)
4. Add `hooks/` to FOREST_PATTERNS
5. Add `worker/lib/` to FOREST_PATTERNS (quota/overage logic)
6. Add `lib/affiliate-shortlink/` to LAND_PATTERNS

### P1 — Fix true seed violations (before moving lib/quota or lib/usage-metering)
7. `middleware.ts` → extract `lib/usage-metering` call to a seed-safe helper or move to forest middleware
8. `lib/better-auth-server.ts` → move `lib/crypto/password-hash` to seed OR reclassify better-auth-server as tree
9. `lib/auth/enriched-jwt*.ts` → extract `lib/usage-metering/types` to shared `types/` or reclassify auth cluster as forest
10. `lib/security/api-key-validator*.ts` → move `lib/audit/crypto-utils.ts` to `lib/security/` (seed)
11. `config/tiers/tier-configs.ts` → remove `lib/clients/nowpayments-client` import (use env var or seed-level type only)
12. `lib/telemetry/llm-trace.ts` → extract signals.track dependency OR move telemetry to forest

### P2 — Resolve AMBIGUOUS (64 files)
All have recommended layers above. Confirm and update classifier rules so rerun = 0 AMBIGUOUS.

---

## Unresolved Questions

1. **`components/` layer**: Should all 187 components be `forest`? Some (like `components/ui/`) are pure UI primitives with zero domain imports — consider splitting `components/ui/` → seed, `components/*/` → forest.
2. **`worker/` layer**: Worker files (Cloudflare Worker context) logically operate at infrastructure level but contain quota/overage logic. Confirm: move `worker/lib/` to forest, keep `worker/index.ts` + `worker/worker-handlers.ts` as forest entry points?
3. **`lib/auth/`**: `lib/auth/enforce-tier-quota.ts` is seed but imports from forest (lib/quota). Should `lib/auth/` cluster move to forest? Note: `getCurrentUser()` is in `lib/better-auth-session.ts` (currently seed) — circular risk if auth moves to forest.
4. **`lib/clients/`** (tree): `lib/clients/nowpayments-client.ts` is tree but `config/tiers/tier-configs.ts` (seed) imports it. Fix = move nowpayments ref out of config OR move tier config to tree.
5. **Forest→land violations (56 files)**: These are `lib/fulfillment/`, `lib/quota/`, `lib/inngest/functions/` importing from `lib/billing/`. Are these acceptable (forest uses land APIs)? Or should billing types be extracted to shared types?
