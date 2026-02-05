# Phase 2: CI/CD Pipeline Architecture

**Priority**: High 🟠
**Status**: Pending
**Context**: [Master Plan](./plan.md)

## 🎯 Objective
Replace manual verification with an automated, robust CI/CD pipeline that guards the `main` branch and ensures every commit is production-ready.

## 🔍 Key Insights (from Research)
- **Current State**: Basic `verify.sh` exists but runs manually or in a simple action.
- **Preview Gap**: No automated E2E testing against Vercel Preview deployments.
- **Protection**: `main` branch needs protection rules to enforce CI passing.
- **Tooling**: Playwright is the industry standard for Next.js E2E; MSW (Mock Service Worker) is best for isolating frontend tests from flaky external APIs.

## 🛠 Implementation Steps

### 1. Configure Playwright
- **Task**: Install and configure Playwright for E2E testing.
- **Config**: `playwright.config.ts` setup for local and CI environments.
- **Mocking**: Integrate MSW or Playwright's native `page.route` to mock external API calls (HeyGen, Polar, etc.) during tests.

### 2. Create GitHub Actions Workflow
Create `.github/workflows/pipeline.yml` (replacing/extending `verify.yml`).
- **Job 1: Quality Check**: Lint, Type-Check, Unit Test (Vitest).
- **Job 2: Preview Deploy**: Deploy to Vercel Preview (using `vercel/actions/prebuilt` or Vercel GitHub integration).
- **Job 3: E2E Test**: Run Playwright against the Preview URL.
- **Job 4: Production Gate**: Only allow merge/deploy if all above pass.

### 3. Implement Test Scenarios
Write critical user journey tests:
- **Auth Flow**: Mock Supabase auth to verify protected routes.
- **Campaign Flow**: Create campaign -> "Mock" Processing -> Verify Result displayed.
- **Public Pages**: Verify Landing page, Pricing, and FAQ load correctly (SEO check).

### 4. Branch Protection Rules
- **Rule**: Require `pipeline/e2e` and `pipeline/quality` checks to pass before merging to `main`.
- **Rule**: Require 1 approval (optional but recommended).

### 5. Secrets Management
- Audit and sync GitHub Secrets with required env vars for CI (e.g., `POLAR_ACCESS_TOKEN` for sandbox, `SUPABASE_...` for test project if needed).

## ✅ Definition of Done
- [ ] PRs automatically trigger the full pipeline.
- [ ] E2E tests run successfully against a Vercel Preview URL.
- [ ] Bad code (failing tests/lint) is blocked from merging.
- [ ] "Mock Mode" is successfully used in CI to avoid API costs.

## 🛡️ Risk Assessment
- **Risk**: E2E tests becoming flaky (false negatives).
- **Mitigation**: Use aggressive retries in CI, isolate tests with MSW, and keep tests focused on critical paths.
