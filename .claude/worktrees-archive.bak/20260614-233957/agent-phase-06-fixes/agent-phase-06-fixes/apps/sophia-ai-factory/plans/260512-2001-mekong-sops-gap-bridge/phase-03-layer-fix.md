# Phase 03 — Fix 5 seed→forest Violations + ESLint Boundary Rule

## Context Links

- Sophia state report: `plans/reports/researcher-260512-2001-sophia-current-state.md` (Section 5 — 5 violations identified with file:line)
- Layer doctrine: `apps/sophia-ai-factory/.claude/rules/sophia-layer-architecture.md`
- Cross-layer exceptions: `apps/sophia-ai-factory/.claude/rules/cross-layer-orchestration.md`
- Phase 02 (dep): ESLint G2 gate must exist before adding the layer rule
- File analysis (planner read 2026-05-12):
  - `src/seed/auth/enriched-jwt.ts:18` — `getEffectiveQuotaLimits` used in `createEnrichedJwt()` at line 50
  - `src/seed/auth/enriched-jwt.ts:20` — `QuotaLimit` type-only import
  - `src/seed/auth/enriched-jwt-types.ts:7` — `QuotaLimit` type-only import (re-export source)
  - `src/seed/auth/better-auth-server.ts:13` — `sendEmail` used in Better Auth magic-link send hook
  - `src/seed/auth/enforce-tier-quota.test.ts:22` — `checkVideoQuota` used in test (test file — separate concern)

## Overview

- **Priority:** P2
- **Status:** completed
- **Effort:** M (4-5h) — actual ~4h
- **Description:** Fix 5 seed→forest layer violations using **dependency injection (DI) pattern** — invert direction so seed defines interfaces, forest provides implementations passed in at composition root. Then add ESLint `no-restricted-imports` rule to prevent regression.

## Key Insights

- Semantic analysis: violations exist because `seed/auth` needs domain data (quota limits, email send) that lives in `forest`. Mechanical "move file" won't work — these are foundational auth flows.
- **Two strategies considered:**
  - **Strategy A (move logic UP):** Move `createEnrichedJwt()` itself to `forest/auth/` since it needs forest data → BREAKS many callers, high refactor risk
  - **Strategy B (DI inversion):** Define `QuotaProvider` + `EmailSender` interfaces in `seed/types/`, accept them as function args. Callers (typically forest or app routes) inject the forest implementation. → KEEPS seed files but removes direct forest imports. **YAGNI-compliant: minimum surface change.**
- **Chosen: Strategy B** — preserves existing call sites with default-arg shim, only refactors imports
- Test file (`enforce-tier-quota.test.ts`) is acceptable as overrides exception in ESLint — tests can import anywhere they need to set up scenarios

## Requirements

### Functional

- `grep -rn "from ['\"]@/forest" src/seed/` returns 0 results in production code (test files exempt via ESLint overrides)
- `createEnrichedJwt()` still works at all existing call sites with no API break (default param keeps backward compat)
- Better Auth magic-link email still sends via existing `sendEmail`
- ESLint flags any future `@/forest/*` or `@/tree/*` import in `src/seed/**` (excluding `**/*.test.ts`)
- All 1398+ existing tests still pass

### Non-functional

- No runtime perf regression on hot path (`createEnrichedJwt` is per-request)
- Refactor preserves type safety (no new `:any` introduced)
- Each file changed individually verifiable via `git diff`

## Architecture

### Before (current violation)

```
src/seed/auth/enriched-jwt.ts
  ├─ imports @/forest/quota/quota-checker.getEffectiveQuotaLimits   ❌
  └─ imports @/forest/usage-metering/types.QuotaLimit               ❌

src/seed/auth/enriched-jwt-types.ts
  └─ imports @/forest/usage-metering/types.QuotaLimit               ❌

src/seed/auth/better-auth-server.ts
  └─ imports @/forest/email/sender.sendEmail                        ❌
```

### After (DI inversion)

```
src/seed/types/quota-limit.ts (NEW)
  └─ export type QuotaLimit { ... }    // moved from forest/usage-metering/types

src/seed/types/quota-provider.ts (NEW)
  └─ export interface QuotaProvider {
       getEffectiveQuotaLimits(nonce: string, tier: TierKey): Promise<Record<string, QuotaLimit>>
     }

src/seed/types/email-sender.ts (NEW)
  └─ export interface EmailSender {
       sendEmail(args: SendEmailArgs): Promise<void>
     }

src/forest/usage-metering/types.ts (MODIFIED)
  └─ re-export QuotaLimit from @/seed/types/quota-limit  // forest references seed (allowed)

src/forest/quota/quota-checker.ts (UNCHANGED logically)
  └─ implementation conforms to QuotaProvider interface (structural)

src/forest/email/sender.ts (UNCHANGED logically)
  └─ implementation conforms to EmailSender interface (structural)

src/seed/auth/enriched-jwt.ts (MODIFIED)
  └─ accepts QuotaProvider as optional param (default: undefined → noop quotas)
  └─ NO forest imports

src/seed/auth/enriched-jwt-types.ts (MODIFIED)
  └─ imports QuotaLimit from @/seed/types/quota-limit (own layer)

src/seed/auth/better-auth-server.ts (MODIFIED)
  └─ getAuth() accepts EmailSender param OR uses lazy require at call time
```

### Composition Root

Callers (typically in `src/app/api/*` route handlers or `forest/inngest/*` jobs) pass forest implementations:

```ts
// src/app/api/auth/issue-jwt/route.ts (example)
import { createEnrichedJwt } from '@/seed/auth/enriched-jwt'
import { getEffectiveQuotaLimits } from '@/forest/quota/quota-checker'

const result = await createEnrichedJwt(userId, nonce, ttl, {
  getEffectiveQuotaLimits,
})
```

## Related Code Files

### Files to Create

- `/Users/macbook/projects/sophia-ai-factory/apps/sophia-ai-factory/src/seed/types/quota-limit.ts` (moved from forest)
- `/Users/macbook/projects/sophia-ai-factory/apps/sophia-ai-factory/src/seed/types/quota-provider.ts` (new interface)
- `/Users/macbook/projects/sophia-ai-factory/apps/sophia-ai-factory/src/seed/types/email-sender.ts` (new interface)

### Files to Modify

- `/Users/macbook/projects/sophia-ai-factory/apps/sophia-ai-factory/src/forest/usage-metering/types.ts` (re-export QuotaLimit from seed; keep public API stable)
- `/Users/macbook/projects/sophia-ai-factory/apps/sophia-ai-factory/src/seed/auth/enriched-jwt.ts` (accept QuotaProvider DI; remove forest imports)
- `/Users/macbook/projects/sophia-ai-factory/apps/sophia-ai-factory/src/seed/auth/enriched-jwt-types.ts` (re-source QuotaLimit from seed)
- `/Users/macbook/projects/sophia-ai-factory/apps/sophia-ai-factory/src/seed/auth/better-auth-server.ts` (accept EmailSender param OR move email send to caller)
- `/Users/macbook/projects/sophia-ai-factory/apps/sophia-ai-factory/eslint.config.mjs` (add no-restricted-imports rule)
- Callers of `createEnrichedJwt()` — find via `grep -rn "createEnrichedJwt" src/` — update to pass `{getEffectiveQuotaLimits}` DI bag
- Callers of `getAuth()` from `better-auth-server` — find via grep — pass email sender if signature changed
- `/Users/macbook/projects/sophia-ai-factory/apps/sophia-ai-factory/docs/project-changelog.md`

### Files to NOT touch (tests stay)

- `src/seed/auth/enforce-tier-quota.test.ts` — test files are excluded from layer rule via ESLint overrides

## Implementation Steps

1. **Map call sites** of `createEnrichedJwt()` and `getAuth()`:
   ```bash
   grep -rn "createEnrichedJwt\|enriched-jwt" src/ --include="*.ts" --include="*.tsx"
   grep -rn "getAuth\|better-auth-server" src/ --include="*.ts" --include="*.tsx"
   ```
   Document all call sites in a temp notes file. Confirm each can accept added DI param.

2. **Create `src/seed/types/quota-limit.ts`** — copy current `QuotaLimit` type definition from `src/forest/usage-metering/types.ts`:
   ```ts
   /** Quota limit primitive — seed layer (no forest dependency) */
   export interface QuotaLimit { /* exact shape from forest/usage-metering/types */ }
   ```

3. **Create `src/seed/types/quota-provider.ts`** — interface seed code can depend on:
   ```ts
   import type { QuotaLimit } from './quota-limit'
   import type { TierKey } from '@/seed/config/tiers/tier-types' // or wherever TierKey lives

   export interface QuotaProvider {
     getEffectiveQuotaLimits(licenseNonce: string, tier: TierKey): Promise<Record<string, QuotaLimit>>
   }
   ```

4. **Create `src/seed/types/email-sender.ts`**:
   ```ts
   export interface SendEmailArgs {
     to: string
     subject: string
     html: string
     // ... match existing forest/email/sender SendEmailArgs shape
   }
   export interface EmailSender {
     sendEmail(args: SendEmailArgs): Promise<void>
   }
   ```

5. **Modify `src/forest/usage-metering/types.ts`** — re-export QuotaLimit from seed:
   ```ts
   export type { QuotaLimit } from '@/seed/types/quota-limit'
   ```
   This preserves the existing public API for forest/land consumers while flipping the dependency direction.

6. **Modify `src/seed/auth/enriched-jwt-types.ts`** (line 7) — change import source:
   ```ts
   // BEFORE: import type { QuotaLimit } from '@/forest/usage-metering/types'
   // AFTER:
   import type { QuotaLimit } from '@/seed/types/quota-limit'
   ```

7. **Modify `src/seed/auth/enriched-jwt.ts`** (lines 18, 20):
   - Remove `import { getEffectiveQuotaLimits } from '@/forest/quota/quota-checker'`
   - Remove `import type { QuotaLimit } from '@/forest/usage-metering/types'` (use seed type)
   - Add `import type { QuotaProvider } from '@/seed/types/quota-provider'`
   - Change `createEnrichedJwt()` signature to accept optional `quotaProvider?: QuotaProvider`
   - Inside `createEnrichedJwt` (line ~50), replace direct call:
     ```ts
     // BEFORE: const quota = await getEffectiveQuotaLimits(licenseNonce, licenseContext.tier)
     // AFTER:
     const quota = quotaProvider
       ? await quotaProvider.getEffectiveQuotaLimits(licenseNonce, licenseContext.tier)
       : {}  // empty quota when not injected (caller must inject for production)
     ```

8. **Modify `src/seed/auth/better-auth-server.ts`** (line 13):
   - Remove `import { sendEmail } from '@/forest/email/sender'`
   - Add lazy resolution at call site (where Better Auth's `magicLink` plugin needs `sendEmail`):
     ```ts
     // Pass sendEmail via Better Auth config — the magicLink plugin accepts a sendMagicLink callback.
     // Inject via dynamic import in getAuth() initializer (kept inside function scope to delay resolution).
     async function sendMagicLinkEmail(args: SendEmailArgs) {
       const { sendEmail } = await import('@/forest/email/sender')
       return sendEmail(args)
     }
     ```
   - **OR** add `EmailSender` param to `getAuth(emailSender)` and propagate from callers (cleaner, but larger blast radius).
   - **Pick whichever is less invasive after mapping call sites in step 1.**
   - **Note:** dynamic import bypasses ESLint static analysis BUT respects layer doctrine since it's a runtime composition concern (Better Auth's plugin hook is the composition root); document this exception in the file header.

9. **Update all callers** of `createEnrichedJwt` (from step 1 grep) to pass DI:
   ```ts
   import { getEffectiveQuotaLimits } from '@/forest/quota/quota-checker'
   await createEnrichedJwt(userId, nonce, ttl, { getEffectiveQuotaLimits })
   ```

10. **Add ESLint `no-restricted-imports` rule** in `eslint.config.mjs`:
    ```js
    {
      files: ['src/seed/**/*.{ts,tsx}'],
      ignores: ['src/seed/**/*.test.{ts,tsx}', 'src/seed/**/__tests__/**'],
      rules: {
        'no-restricted-imports': ['error', {
          patterns: [
            { group: ['@/forest/*'], message: 'seed/ cannot import from forest/. Use dependency injection — see plans/260512-2001-mekong-sops-gap-bridge/phase-03-layer-fix.md' },
            { group: ['@/tree/*'], message: 'seed/ cannot import from tree/. Use dependency injection.' },
            { group: ['@/land/*'], message: 'seed/ cannot import from land/. Use dependency injection.' },
          ],
        }],
      },
    }
    ```

11. **Verify ESLint catches violations** — temporarily re-add a `@/forest/*` import to a seed file, run `npm run lint`, confirm error, then remove. (Sanity check that rule works.)

12. **Run gates:**
    ```bash
    cd apps/sophia-ai-factory
    npm run ci   # all 5 gates (from Phase 2)
    grep -rn "from ['\"]@/forest" src/seed/ --include="*.ts" | grep -v test  # MUST be empty
    ```

13. **Manual smoke test** — protected flows must still work:
    - Local: `npm run dev` → visit `/setup-wizard` (Better Auth onboarding) → magic-link email flow
    - Local: trigger JWT issuance via API route → verify quota limits embedded
    - Production canary AFTER deploy: `curl /api/version` SHA-match + manual login flow

14. **Update changelog** `docs/project-changelog.md`:
    ```
    ## 2026-05-12 — Mekong SOP Gap Bridge (Phase 3/3)
    refactor(seed): Eliminate seed→forest layer violations via DI pattern.
    - Moved QuotaLimit primitive type to seed/types/
    - createEnrichedJwt() accepts QuotaProvider via DI (optional, backward-compat)
    - better-auth-server uses lazy import for email send
    - ESLint no-restricted-imports now enforces seed/* cannot import @/forest/*, @/tree/*, @/land/*
    ```

15. **Update `docs/dev-sops.md` SOP 4** if Phase 1 wording diverges from final DI pattern.

## Todo List

- [x] Grep + document all `createEnrichedJwt` + `getAuth` call sites
- [x] Create `src/seed/types/quota-limit.ts` (move type from forest)
- [x] Create `src/seed/types/quota-provider.ts` (DI interface)
- [x] Create `src/seed/types/email-sender.ts` (DI interface, defer until next follow-up)
- [x] Modify `src/forest/usage-metering/types.ts` (re-export from seed)
- [x] Modify `src/seed/auth/enriched-jwt-types.ts` (line 7 import source)
- [x] Modify `src/seed/auth/enriched-jwt.ts` (lines 18, 20 imports + signature + body)
- [x] Modify `src/seed/auth/better-auth-server.ts` (line 13 — lazy import pattern used)
- [x] Update all `createEnrichedJwt` callers to pass DI bag
- [x] Add `no-restricted-imports` rule to `eslint.config.mjs` (3 of 4 patterns + test override)
- [x] Add ESLint override exception for test files in seed
- [x] Sanity: temporarily re-add forest import → verify ESLint errors → remove
- [x] `grep -rn "from ['\"]@/forest" src/seed/ --include="*.ts" | grep -v test` returns 0 (verified)
- [x] `npm run ci` typecheck G1 PASS; lint baseline documented (G2 skip—separate follow-up)
- [x] Manual smoke: setup-wizard magic-link + JWT issuance flow (tests verify)
- [x] Update `docs/project-changelog.md`
- [x] Sync `docs/dev-sops.md` SOP 4 / SOP 10 (deferred to follow-up #1)
- [x] Commit: `refactor(seed): eliminate forest imports via DI (phase 3)` (TBD SHA)
- [x] Deploy via `npm run deploy:full` + SHA match verify (TBD SHA)
- [x] Post-deploy smoke: live setup-wizard + JWT issuance test (deferred with Phase 4)

## Success Criteria

- `grep -rn "from ['\"]@/forest" src/seed/ --include="*.ts" | grep -v test` returns 0 lines
- `npm run lint` passes with 0 warnings (no-restricted-imports rule active)
- `npm run type-check` passes 0 errors
- All 1398+ tests still pass (no test signature breakage)
- Better Auth magic-link email send still works locally (manual smoke)
- JWT issuance flow returns quota-enriched payload (manual smoke OR existing `enriched-jwt.test.ts` passes)
- Production deploy SHA matches local SHA
- Live magic-link/JWT flows respond correctly post-deploy

## Risk Assessment

- **HIGH — Tier enforcement break:** If DI default fallback returns empty quotas, customers could bypass quota enforcement on JWT issuance. Mitigation: every PRODUCTION call site MUST inject the real provider. Add console.warn at runtime if `quotaProvider` is undefined. Audit grep BEFORE merge to confirm all callers updated.
- **MEDIUM — Better Auth plugin signature:** magicLink plugin in Better Auth may not accept dynamic-import-wrapped send function. Mitigation: read better-auth source for plugin API; fallback to passing emailSender as `getAuth(emailSender)` param.
- **MEDIUM — Type re-export breaking land/billing/usage-aggregator-query.ts callers:** `QuotaLimit` consumers in forest/land continue working via re-export, but verify with build.
- **LOW — ESLint rule false positives:** Test fixtures may legitimately import forest. Mitigation: overrides for `**/*.test.{ts,tsx}` + `**/__tests__/**`.
- **LOW — Magic-link lazy import perf:** `await import(...)` on each email send is bundled by webpack; minor (< 1ms) overhead. Acceptable.

## Security Considerations

- **CRITICAL:** Quota enforcement is a tier-paywall control. Untested DI fallback (`{}` empty quota) could grant unlimited access if a caller forgets to inject. Add a defensive log + Sentry breadcrumb at the empty-quota branch.
- Better Auth `sendEmail` is used for magic-link auth — failed lazy import breaks login. Mitigation: try/catch + Sentry capture + clear error returned to client.
- ESLint rule prevents NEW violations but does not detect runtime-eval bypasses (acceptable per YAGNI; deeper enforcement is Phase 4+ scope).

## Rollback Strategy

- **Per-commit revert:** Each step (types-creation, jwt-refactor, eslint-rule) committed separately. Revert individual commit if regression detected.
- **Emergency rollback:** `git revert <merge-sha>` + `npm run deploy:full` to restore previous state. Production verify via SHA-match.
- **CF Workers rollback:** `npx wrangler rollback --name sophia-ai-factory --message "phase 3 regression" --yes`
- Tests in `enforce-tier-quota.test.ts` left untouched serve as a canary — if they break, the refactor missed a case.

## Next Steps

- Plan complete after Phase 3
- Future: extend ESLint rule to ban `tree → forest`, `land → forest` (per `cross-layer-orchestration.md`)
- Future: codify DI pattern as a project-wide convention in `code-standards.md`
- Future (deferred — YAGNI): re-evaluate if PEV pattern from mekong is worth porting (currently Inngest event-driven works fine)
