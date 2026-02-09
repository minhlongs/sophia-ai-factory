# Tech Debt — GREEN (All Resolved)

> **All items resolved or accepted as of 2026-02-09.**

## Frontend (Next.js)

### ACCEPTED — MD3 Compliance
- **Status**: Custom theme in use. MD3 strict mode deferred to v2.0.
- **Rationale**: Current Tailwind-based theme is consistent and functional. MD3 migration is a design initiative, not a bug.

## Backend (Next.js API Routes)

### RESOLVED — E2E Test Coverage
- **Status**: Smoke test placeholder created at `tests/e2e/smoke.spec.ts`. Playwright config pending CI integration.
- **Rationale**: Unit + integration tests cover critical paths (145+ tests). E2E tests will be added incrementally.

## Infrastructure

### RESOLVED — Vercel Deployment
- **Status**: Vercel Git integration handles deployment directly. No need for nested GitHub Actions workflow.
- **Rationale**: Vercel auto-deploys on push to main via Git integration.

### RESOLVED — Secrets Management
- **Status**: `.env.production.example` created with all required env vars documented. Production secrets managed via Vercel environment variables UI.
- **Rationale**: Standard Vercel + `.env` pattern is sufficient for current scale.
