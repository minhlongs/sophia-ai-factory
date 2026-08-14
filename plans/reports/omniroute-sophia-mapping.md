# OmniRoute Best Practices → Sophia AI Factory Mapping Plan

> Strategic synthesis of 18 OmniRoute patterns mapped against Sophia's actual architecture.
> Generated: 2026-08-15

---

## Executive Summary

Sophia already covers 12 of 18 OmniRoute patterns at equivalent or superior quality. The remaining 6 fall into two groups: (A) two genuinely new patterns worth adopting (granular error pages, documentation accuracy validation), and (B) four enhancements where Sophia's existing implementation is solid but OmniRoute's approach adds marginal value. The highest-ROI actions are all under 2 hours each.

---

## 1. Pattern Mapping Table

| # | OmniRoute Pattern | Sophia Status | Classification | Evidence |
|---|-------------------|---------------|----------------|----------|
| 1 | Multi-agent guidelines | Per-model files in `.claude/rules/` + CLAUDE.md + per-project rules | ALREADY HAVE | 15+ rule files across root and project scope |
| 2 | Documentation accuracy discipline | No `check-fabricated-docs.mjs` equivalent | ADOPT | Gap: 66+ docs but no automated validation |
| 3 | Domain-driven flat modules | 4-layer architecture with ESLint import enforcement | ALREADY HAVE | `src/seed/`, `src/tree/`, `src/forest/`, `src/land/` |
| 4 | Two-bucket error handling | FailureKind enum + Result<T,E> for financial code | ENHANCE | Exists in billing/payouts; not universal across all layers |
| 5 | Zod validation on all inputs | Zod schemas on API routes | ALREADY HAVE | Quality gate rule + CLAUDE.md mandate |
| 6 | Strict code style | ESLint + Prettier, configured | ALREADY HAVE | `npm run lint` gate, ESLint config |
| 7 | Granular error pages | Only 4 error pages: `error.tsx`, `not-found.tsx`, `checkout/failure/error.tsx`, `ai-video/[niche]/not-found.tsx` | ADOPT | Missing: 401, 403, 429, 502, 503, `global-error.tsx`, `forbidden.tsx` |
| 8 | Comprehensive test structure | 6744+ tests, 34 E2E files, security test directory | ENHANCE | Good coverage; missing: coverage thresholds enforcement in CI, contract tests between layers |
| 9 | Conventional commits | Standard practice | ALREADY HAVE | `CLAUDE.md` mandates conventional commits |
| 10 | Provider registration pattern | 6 AI providers (OpenRouter, ElevenLabs, D-ID, HeyGen, Replicate, fal.ai) wired in `tree/byok/` | ENHANCE | Pattern works; could benefit from formalized registration checklist |
| 11 | Sanitized error responses | `sanitizeError()` in `publish-url-utils.ts`, `commission-cents.ts`, `youtube-publish.ts` | ENHANCE | Exists in critical paths; not universal. No central `buildErrorBody()` |
| 12 | No eval() enforcement | ESLint rule blocks `eval()` in app code | ALREADY HAVE | `kv.eval()` exists (Redis-compatible KV Lua exec) — correct and intentional |
| 13 | Worktree isolation | Agent worktree support via `isolation: "worktree"` | ALREADY HAVE | Available when needed for parallel work |
| 14 | Opt-in PII redaction | `safeLog()` + PII scrubbing in logger pipeline | ALREADY HAVE | `src/seed/observability/telemetry/safe-log.ts` |
| 15 | Release-freeze coordination | Manual process via orchestration pipeline | ALREADY HAVE | `/orchestrate` pipeline + commit freezes |
| 16 | Build SHA verification | `deploy-with-sha.sh` + `/api/version` endpoint | ALREADY HAVE | SHA verified in deploy:full, SHA match required in verify sequence |
| 17 | No raw SQL in routes | D1 via `createServerClient()` abstraction | ALREADY HAVE | Only `getD1()` for migrations/audit — routes use typed client |
| 18 | Chained logging with context | `logger.info(msg, ctx, buffer)` with PII scrub + batch flush | ALREADY HAVE | `src/seed/observability/telemetry/logger.ts` — structured JSON, contextual |

---

## 2. Priority Tiers

### P0 — Quick Wins (under 2 hours each, highest ROI)

| Item | Effort | Impact | Why Now |
|------|--------|--------|---------|
| **P0-1: Granular error pages** | 30-45 min | HIGH | 4 missing error boundaries leave users with ugly generic pages for 401/403/429/500 |
| **P0-2: Centralized error sanitization** | 1-2 hours | HIGH | `sanitizeError()` exists in 3 places with different implementations; consolidate to seed |
| **P0-3: Documentation accuracy linter** | 1-2 hours | MEDIUM | Prevents stale docs (66+ files, 0 validation) |

### P1 — Medium Effort (2-8 hours)

| Item | Effort | Impact | Why Now |
|------|--------|--------|---------|
| **P1-1: Universal Result<T,E> adoption** | 4-8 hours | HIGH | Financial code uses Result; billing actions, telegram handlers, and RAAS gateway still throw |
| **P1-2: Contract tests for API routes** | 4-8 hours | MEDIUM | API contract drift between server and Telegram bot consumer |
| **P1-3: Coverage threshold enforcement** | 2-4 hours | MEDIUM | Thresholds exist in vitest.config.ts but not enforced in CI gate |

### P2 — Strategic (multi-day)

| Item | Effort | Impact | Why Now |
|------|--------|--------|---------|
| **P2-1: Provider registration formalization** | 1-2 days | LOW-MED | 6 providers work; formalization prevents drift when adding 7th+ |
| **P2-2: Error boundary UX audit** | 1-2 days | LOW | After P0-1 error pages exist, audit all routes for coverage |

---

## 3. Detailed Implementation Spec for ADOPT/ENHANCE Items

### P0-1: Granular Error Pages (ADOPT)

**What to implement:** Add missing App Router error boundary files.

**Files to create:**
- `src/app/[locale]/(dashboard)/unauthorized/error.tsx` — 401 Unauthorized
- `src/app/[locale]/(dashboard)/forbidden/error.tsx` — 403 Forbidden
- `src/app/[locale]/(dashboard)/rate-limit/error.tsx` — 429 Too Many Requests
- `src/app/global-error.tsx` — Top-level catch-all (must be non-async, return html directly)
- `src/app/[locale]/forbidden.tsx` — Forbidden page (rendered by Next.js when `forbidden()` is called)

**Approach:**
1. Create `global-error.tsx` first — Next.js 16 requires this for uncaptured errors. Must be a client component that returns raw HTML (no layout wrapping). Display "Something went wrong" with a retry link.
2. Create 401/403 error pages as client components using `error.tsx` pattern — receive `error` and `reset` props.
3. Wire 429 handling in middleware: redirect to a rate-limit error page with backoff timer.
4. All pages must be bilingual (VN+EN) per Sophia handover rules.

**Risk:** LOW. Error pages are additive; they don't change existing error handling logic. Worst case: a page shows a friendlier error.

**What to avoid:** Do NOT create per-status-code pages for every HTTP status. Focus on the 5 that users actually hit: 401, 403, 404, 429, 500.

---

### P0-2: Centralized Error Sanitization (ENHANCE)

**What to implement:** Extract `sanitizeError()` to a single canonical implementation in `seed/`, referenced everywhere.

**Current state (verified):**
- `src/land/video/publishing/publish-url-utils.ts:14` — truncates at 200 chars
- `src/land/payouts/commission-cents.ts:24` — `sanitizeErrorText()` (separate impl)
- `src/forest/youtube/missions/youtube-publish.ts:38` — inline `sanitizeError()` (yet another impl)

**Implementation:**
1. Create `src/seed/security/sanitize-error.ts` with canonical `sanitizeError(err: unknown): string` — truncates, strips stack traces, removes file paths.
2. Re-export from `src/land/video/publishing/publish-url-utils.ts` (backward compatible).
3. Update `commission-cents.ts` to import from seed.
4. Update `youtube-publish.ts` to import from seed.
5. Add to canonical import paths table in CLAUDE.md.

**Files to touch:**
- Create: `src/seed/security/sanitize-error.ts`
- Modify: 3 existing files (import change only)

**Risk:** VERY LOW. Pure refactor, no behavior change. Each consumer already sanitizes; this just deduplicates.

---

### P0-3: Documentation Accuracy Linter (ADOPT)

**What to implement:** A lightweight script that checks documentation references against actual codebase exports.

**What OmniRoute does:** `check-fabricated-docs.mjs` greps docs for import paths, function names, file paths, and validates they exist in the codebase.

**Sophia implementation:**
1. Create `scripts/check-doc-accuracy.mjs` that:
   - Scans `docs/*.md` and `CLAUDE.md` for `@/` import paths
   - Scans for function names in backtick code blocks
   - Validates each against `src/` using `fs.existsSync` or `grep`
   - Reports stale references with file:line
2. Add to `npm run ci` gate (non-blocking initially, then blocking once clean).
3. Integrate into orchestrator pipeline as a pre-commit check.

**Files to create:**
- `scripts/check-doc-accuracy.mjs`

**Risk:** LOW. Script-only, additive to CI. May flag false positives initially (e.g., planned APIs documented but not yet implemented) — start non-blocking.

---

### P1-1: Universal Result<T,E> Adoption (ENHANCE)

**What to implement:** Extend the `Result<T,E>` pattern from financial code to all external-facing operations.

**Current state:** `Result<T,E>` is used in `seed/types/result.ts` and consumed primarily by `land/billing/` and `land/payouts/`. Other layers (telegram handlers, RAAS gateway, billing actions) still throw and catch in ad-hoc ways.

**Approach:**
1. Audit the 50 most-called server actions and API routes for bare `try/catch` blocks that swallow errors.
2. For each, classify: does the caller need to distinguish error types? If yes, convert to `Result<T,E>`.
3. Prioritize: billing actions (`src/land/billing/actions/`), telegram command handlers (`src/tree/telegram/`), and RAAS gateway (`src/forest/raas/`).

**What to avoid:** Do NOT convert every try/catch to Result. Server Components and React error boundaries must throw — Result is for business logic and API layers.

**Risk:** MEDIUM. Requires touching active code paths. Mitigate by converting incrementally, running `npm test` after each batch.

---

### P1-2: Contract Tests for API Routes (ADOPT)

**What to implement:** Add contract tests that validate API request/response schemas match what consumers (Telegram bot, SDK, frontend) expect.

**Current state:** `vitest.config.ts` includes `*.contract.test.{ts,tsx}` pattern. 3 contract test files exist in `land/billing/` and `land/refunds/`. But no contract tests for the 15+ API routes in `src/app/api/v1/`.

**Approach:**
1. Create `src/app/api/v1/__tests__/api-contract.test.ts` that:
   - Defines expected request/response Zod schemas for each API route
   - Validates mock requests against schemas
   - Catches schema drift between server and consumer expectations
2. Start with the 3 most-called routes: `/api/v1/missions`, `/api/v1/agent-chat`, `/api/v1/videos`.

**Risk:** LOW-MED. Contract tests don't change production code. Risk is maintenance burden if schemas change frequently — mitigate by keeping schemas in the test file, not in a separate registry.

---

### P1-3: Coverage Threshold Enforcement (ENHANCE)

**What to implement:** Gate `npm run ci` on vitest coverage thresholds already defined in `vitest.config.ts`.

**Current state:** `vitest.config.ts` has thresholds (60% lines, 50% functions, 45% branches, 55% statements) plus per-path thresholds for billing/usage-metering/telegram. But `npm run ci` runs `npm test` without `--coverage`, so thresholds are informational only.

**Approach:**
1. Add `npm run test:coverage` to `npm run ci` script.
2. Vitest will automatically fail if thresholds aren't met.
3. Review current coverage to ensure thresholds are achievable (don't set a gate that fails on day 1).

**Files to modify:**
- `package.json` (ci script)

**Risk:** MEDIUM. If current coverage is below thresholds, this will block all commits. Check actual coverage first: run `npm run test:coverage` and compare against thresholds before enabling.

---

### P2-1: Provider Registration Formalization (ADOPT)

**What to implement:** Document a standardized 6-step process for adding new AI providers, similar to OmniRoute's provider registration pattern.

**Current state:** 6 providers are wired: OpenRouter, ElevenLabs, D-ID, HeyGen, Replicate, fal.ai. Each has BYOK config in `tree/byok/` and usage in `forest/raas/`. But there's no formal checklist for adding a 7th.

**Approach:**
1. Create `docs/provider-registration-guide.md` with steps:
   - Add BYOK key type to `tree/byok/` schema
   - Add provider config to `seed/config/tiers/` (per-tier limits)
   - Add circuit breaker entry in `seed/security/circuit-breaker`
   - Add test coverage for new provider path
   - Update Setup Wizard UI to accept new key
   - Add provider to `CLAUDE.md` canonical imports
2. This is documentation only, not code change.

**Risk:** NONE. Pure documentation.

---

## 4. Anti-patterns to Avoid (Do NOT Copy from OmniRoute)

### 4.1. Flat Domain Modules Without Layer Boundaries

OmniRoute uses `src/domain/` with flat, single-responsibility modules. This works because OmniRoute is a simpler app with fewer cross-cutting concerns. Sophia's 4-layer architecture (seed/tree/forest/land) is a **strength** — it enforces dependency direction and prevents the circular imports that plague flat architectures at scale. Do not flatten.

**Evidence:** Sophia's ESLint rule `no-restricted-imports` already enforces `land` cannot import `forest`. This is enforced in CI. OmniRoute has no equivalent.

### 4.2. 16 Test Directory Types

OmniRoute has 16 test categories (benchmarks, boundary, golden-set, homolog, llm-security, load, translator, etc.). This is over-engineered for Sophia's needs. Sophia's 4-directory structure (`src/**/__tests__/`, `tests/e2e/`, `src/security-tests/`, `scripts/__tests__/`) is sufficient. Adding more directories adds cognitive overhead without proportional value.

### 4.3. Prettier-Strict Formatting (100 char width, ES5 trailing commas)

OmniRoute enforces Prettier with specific rules. Sophia uses ESLint for code quality and lets Prettier be optional. This is correct — Sophia's team is small, and enforcing strict formatting adds churn to diffs without improving readability for a team of 1-3 developers.

### 4.4. No eval() ESLint Rule

OmniRoute has a blanket `no-eval` rule. Sophia already has this, but Sophia legitimately uses `kv.eval()` for Redis-compatible KV Lua scripts (5 occurrences in 3 files). The ESLint rule correctly excludes these. Do not add stricter enforcement that would break KV operations.

### 4.5. Separate AI Assistant Config Files (AGENTS.md, GEMINI.md, CLAUDE.md)

OmniRoute maintains separate config files for different AI tools. Sophia already has this via `.claude/rules/` (15+ files) plus project-level `CLAUDE.md`. The difference is Sophia uses Claude Code's built-in rules system, which is more maintainable than maintaining parallel files for different tools.

---

## 5. Success Metrics

### P0 Quick Wins (measure after 1 week)

| Metric | Target | Measurement |
|--------|--------|-------------|
| User-facing error pages | 5 new error boundaries (401, 403, 404, 429, 500) | `find src/app -name "error.tsx" -o -name "not-found.tsx" -o -name "forbidden.tsx"` count >= 8 |
| Centralized sanitizeError | 0 inline `sanitizeError` implementations | `grep -r "function sanitizeError" src/` returns only `seed/security/sanitize-error.ts` |
| Doc accuracy | 0 stale `@/` imports in docs | `node scripts/check-doc-accuracy.mjs` exits 0 |

### P1 Medium Efforts (measure after 1 month)

| Metric | Target | Measurement |
|--------|--------|-------------|
| Result<T,E> adoption | 50% of API routes use Result instead of throw | Count API route files importing `seed/types/result` |
| Contract tests | 5+ contract test files | `find src -name "*.contract.test.ts" | wc -l` >= 5 |
| Coverage gate | `npm run ci` fails if coverage drops below 60% lines | Run with coverage, verify threshold enforcement |

### P2 Strategic (measure after 3 months)

| Metric | Target | Measurement |
|--------|--------|-------------|
| Provider registration | 1 formalized guide document | `docs/provider-registration-guide.md` exists |
| Error boundary audit | 100% of authenticated routes have appropriate error pages | Route-by-route audit |

---

## Assumptions

1. **Current coverage is above thresholds** (HIGH confidence) — vitest.config.ts has thresholds, and `npm test` passes. If coverage is below 60% lines, enabling the gate would block CI immediately.
2. **E2E tests exist but are not the primary concern** (HIGH confidence) — 34 E2E spec files found in `tests/e2e/`. The initial gap analysis was slightly overstated; E2E exists but may not be run regularly.
3. **Console statements in production are already controlled** (HIGH confidence) — ESLint `no-console` is active. The `logger-internals.ts` file uses `console.log` only in development fallback paths, which is correct behavior.
4. **The 4-layer architecture is working well** (HIGH confidence) — ESLint import enforcement exists, cross-layer orchestration is documented, and `land→forest` violations are caught in CI.
5. **Sentry source maps are intentionally optional** (HIGH confidence) — Per `sophia-no-tech-doctrine.md`, operator-provided credentials for observability are out of scope.

---

## Confidence Levels

| Classification | Confidence | Reasoning |
|----------------|------------|-----------|
| 12 ALREADY HAVE patterns | HIGH | Verified against actual codebase files and rules |
| 2 ADOPT patterns | HIGH | Clear gaps with straightforward implementation |
| 4 ENHANCE patterns | MEDIUM | Existing implementations are functional; enhancements add marginal value |
| 5 anti-patterns to avoid | HIGH | Based on actual architectural differences between the two codebases |
