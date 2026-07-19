# Verification Commands & Quality Gates Analysis

## 1. Master Verification Command

The primary command for "Green" verification is:

```bash
npm run verify
```

This executes `scripts/verify.sh`, which enforces the following sequence:

| Step | Action | Command | Gate Criteria |
|------|--------|---------|---------------|
| 1 | Linting | `npm run lint` | ESLint strict compliance (0 errors) |
| 2 | Type Check | `npm run type-check` | TypeScript strict mode (0 errors) |
| 3 | Unit Tests | `npm run test -- --run --coverage` | 100% pass rate (Vitest) |
| 4 | Security | `npm audit --audit-level=critical` | 0 critical vulnerabilities |
| 5 | Prod Build | `npm run build` | Successful Next.js build |
| 6 | Mock Build | `NEXT_PUBLIC_MOCK_AI_SERVICES=true npm run build` | Successful build in mock mode |

## 2. Individual Verification Commands

| Scope | Command | Description |
|-------|---------|-------------|
| **Unit Tests** | `npm run test` | Runs Vitest suite (currently 154/154 passing) |
| **E2E Tests** | `npm run test:e2e` | Runs Playwright tests with mock services |
| **Smoke Test** | `npm run test:smoke` | Validates `/api/health` and home page availability |
| **Type Check** | `npm run type-check` | Runs `tsc --noEmit` |
| **Linting** | `npm run lint` | Runs `eslint` |

## 3. Quality Gate Requirements

According to `CERTIFICATION.md` and `verify.sh`:

- **Status**: 🟢 APPROVED FOR RELEASE (as of 2026-02-05)
- **Strict Gates**:
  - **Build**: Must pass both standard and mock configurations.
  - **Tests**: All unit tests must pass.
  - **Security**: No critical npm vulnerabilities.
- **Soft Gates (Warnings ⚠️)**:
  - **Coverage**: Current levels are low but do not block release:
    - Lines: ~26%
    - Statements: ~25%
    - Functions: ~15%
    - Branches: ~24%

## 4. Smoke Test Procedure (`scripts/smoke-test.ts`)

Post-deployment verification uses `npm run test:smoke` which performs:
1.  **Health Check**: GET `/api/health` (optionally with `HEALTH_CHECK_SECRET`).
    -   Expects `status: 'healthy'` or `'degraded'`.
2.  **Home Page**: GET `/`.
    -   Expects HTTP 200 OK.

## 5. Manual Verification Scripts (Not in npm scripts)

These scripts provide deeper "Go Live" verification but must be run manually via `npx tsx`:

| Script | Purpose | Key Checks |
|--------|---------|------------|
| `scripts/test-go-live-end-to-end.ts` | **E2E Integration** | 1. Telegram Webhook simulation<br>2. Discovery API (`/api/discovery/top-50`) |
| `scripts/health-check.js` | **Dependency Health** | 1. `.env.local` validation<br>2. Connectivity check to OpenRouter, ElevenLabs, D-ID, Airtable |

## 6. Certification Status
- **Commit**: `dfff8ea`
- **Environment**: Production
- **Status**: All automated gates passed.

## Unresolved Questions
- **Coverage**: Thresholds are not enforced (Lines: ~26%). Should we add a minimum gate?
- **E2E Integration**: `scripts/test-go-live-end-to-end.ts` is not wired into `package.json` or `verify.sh`. Should it be added to the automated pipeline?
- **Playwright**: `npm run test:e2e` exists but is not part of `verify.sh`.
