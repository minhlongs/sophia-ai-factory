# Phase 03 — E2E Test Infrastructure Fix

**Priority:** P1 High | **Effort:** 1-2h | **Status:** pending | **Blocks:** Phase 04

## Context

E2E tests run via Playwright against a local `wrangler dev --local` server. The local D1 database is managed by Miniflare and stored as a SQLite file at `.wrangler/state/v3/d1/miniflare-D1DatabaseObject/<hash>.sqlite`.

**Current state:** The E2E test infrastructure already has a working D1 helper pattern in `tests/e2e/fixtures/free100-db-helpers.ts` that:
- Resolves the local D1 SQLite path
- Opens it with `better-sqlite3`
- Seeds test data directly

**The problem:** Auth-flow and checkout-flow E2E tests do not use `free100-db-helpers` — they rely on the running dev server's D1 being initialized. If the local D1 hasn't been initialized (no `npm run dev` run), or migrations are stale, E2E tests fail because the server cannot query D1.

Additionally, `playwright.config.ts` webServer command runs `wrangler dev --local` which starts a local Cloudflare Worker — but it uses `.env.local` vars only. If `NEXT_PUBLIC_MOCK_AI_SERVICES=true` is required but missing, the D1 layer may attempt real API calls and fail.

## Scope

This phase is **infrastructure enablement** — making sure the E2E dev server can start and D1 is mockable/available. It does NOT fix individual test failures (that's Phase 04).

## Approach: Environment + D1 Bootstrap

### Step 1: Ensure required env vars

Check `.env.local` for these required E2E env vars:

```
NEXT_PUBLIC_MOCK_AI_SERVICES=true
```

Optionally add `NEXT_PUBLIC_MOCK_D1=true` as a flag to skip D1-dependent server-side calls in mock mode. This requires a code change in the D1 client to short-circuit when the flag is set.

**Simpler alternative (preferred):** Ensure the local D1 is initialized before E2E runs. Since `wrangler dev --local` auto-initializes D1 with migrations on first run, the fix may simply be:

```bash
# Run dev once to bootstrap local D1
npm run dev &
sleep 15
kill %1
# Now D1 is initialized for E2E tests
```

### Step 2: Add D1 bootstrap to global-setup.ts

Add D1 initialization to `tests/e2e/global-setup.ts`:

```typescript
// Check if local D1 SQLite exists
import { existsSync } from 'fs'
import { getLocalD1Path } from './fixtures/free100-db-helpers'

export default async () => {
  // ... existing setup ...

  // Verify local D1 is initialized
  try {
    const d1Path = getLocalD1Path()
    if (!existsSync(d1Path)) {
      console.warn('⚠️  Local D1 not found. Run `npm run dev` once to bootstrap.')
      console.warn('   Some E2E tests may fail without D1.')
    } else {
      console.log('✅ Local D1 found at:', d1Path)
    }
  } catch (err) {
    console.warn('⚠️  Could not locate local D1:', err)
    console.warn('   Run `npm run dev` once to bootstrap D1.')
  }

  // ... rest of setup ...
}
```

### Step 3: Verify Playwright webServer config

Current webServer in `playwright.config.ts` (lines 36-43):

```typescript
webServer: isRemote
  ? undefined
  : {
      command: process.env.E2E_PREBUILT === '1'
        ? 'npx wrangler dev --local --port 3000'
        : 'bash -c "export $(grep -v \'^\' .env.local | xargs) && npm run build && ... && npx wrangler dev --local --port 3000"',
      url: BASE_URL,
      reuseExistingServer: !process.env.CI,
      timeout: process.env.E2E_PREBUILT === '1' ? 60_000 : 300_000,
    },
```

**Issue:** The full build path takes up to 5 minutes. For quick E2E iteration, use `E2E_PREBUILT=1` with a pre-built `.open-next`. But `E2E_PREBUILT=1` needs `npm run build` to have been run at least once.

**Fix:** Document the quick E2E workflow:

```bash
# First time: build once
npm run build
node scripts/fix-instrumentation-standalone.mjs
npx @opennextjs/cloudflare build --skipNextBuild

# Then run E2E with prebuilt
E2E_PREBUILT=1 npm run test:e2e
```

### Step 4: Add D1 mock env flag (optional, if D1 bootstrap is insufficient)

If E2E tests still fail because D1 queries time out in local wrangler, add a server-side mock flag:

In `src/seed/db/client.ts` (or wherever `createServerClient` is defined):

```typescript
export function createServerClient() {
  // In mock mode, return a no-op D1 stub for E2E tests
  if (process.env.NEXT_PUBLIC_MOCK_D1 === 'true') {
    return createMockD1Client()
  }
  // ... existing implementation ...
}
```

**Do NOT implement this unless D1 bootstrap fails.** Prefer fixing D1 init over adding mock code.

## Files to Modify

| File | Action | Risk |
|------|--------|------|
| `tests/e2e/global-setup.ts` | Add D1 existence check + warning | Low |
| `playwright.config.ts` | No change needed (verify webServer timeout sufficient) | None |
| `.env.local` | Verify `NEXT_PUBLIC_MOCK_AI_SERVICES=true` | None |

## Implementation Sequence

1. Read `tests/e2e/global-setup.ts` — understand current setup flow
2. Read `tests/e2e/fixtures/free100-db-helpers.ts` — understand `getLocalD1Path()`
3. Add D1 check to `global-setup.ts` (warn if missing, not block)
4. Verify `.env.local` has `NEXT_PUBLIC_MOCK_AI_SERVICES=true`
5. Run `npm run dev` in background, wait 15s, kill — bootstrap local D1
6. Run `npm run test:e2e -- tests/e2e/auth-flow.spec.ts --reporter=list` — verify it runs
7. If auth-flow fails with D1 errors: check migration status, apply missing migrations
8. If still fails: implement `NEXT_PUBLIC_MOCK_D1` flag as fallback
9. Document the working E2E workflow in the test output

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Local D1 SQLite missing (never ran dev) | High | High | Document `npm run dev` bootstrap. Add warning in global-setup. |
| Stale D1 migrations (schema mismatch) | Medium | High | Run `bash scripts/apply-migrations.sh` against local D1. |
| `wrangler dev --local` timeout (5 min) | Low | Medium | Use `E2E_PREBUILT=1` after initial build. |
| `NEXT_PUBLIC_MOCK_AI_SERVICES` not set | Low | High | Verify in `.env.local`. Add assertion in global-setup. |
| D1 mock `NEXT_PUBLIC_MOCK_D1` introduces test-only code paths | Medium | Medium | Only implement as fallback. Mark with `// E2E-only` comments. |

## Rollback

```bash
git revert <commit-hash>
# Only global-setup.ts modified. No production code changes.
```

## Success Criteria

- [ ] `tests/e2e/global-setup.ts` warns if local D1 missing (does not crash)
- [ ] D1 bootstrap via `npm run dev` works on first run
- [ ] `npm run test:e2e -- tests/e2e/auth-flow.spec.ts` starts without D1-related errors
- [ ] `npm run test:e2e -- tests/e2e/checkout-flow.spec.ts` starts without D1-related errors
- [ ] Working E2E workflow documented: build once → `E2E_PREBUILT=1 npm run test:e2e`
