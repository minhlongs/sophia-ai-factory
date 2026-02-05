# Binh Pháp Full Automation Strategy

**Status**: 🏗️ Planning
**Objective**: Achieve "Click-to-Ship" maturity with zero-touch CI/CD, fully mocked local development, and automated production verification.

## 📊 Strategy Overview
This plan implements the "Binh Pháp" methodology (Secure, Verified, Automated) to transform the current manual deployment process into a robust, enterprise-grade pipeline.

### Core Principles
1.  **Mock First**: Local dev & CI must run 100% offline/free using "Mock Mode".
2.  **Verify Then Trust**: No deployment without passing the "Green" quality gate.
3.  **Infrastructure as Code**: All infra (Vercel, Supabase, Polar) defined in code/scripts.

## 🗓️ Phases

### [Phase 1: Mock Infrastructure & Test Harness](./phase-01-mock-infrastructure.md)
**Goal**: Enable `npm run dev:mock` and robust E2E testing without paid APIs.
- [ ] Implement `MockHeyGenClient` and `MockVideoService`.
- [ ] Standardize `NEXT_PUBLIC_MOCK_AI_SERVICES` flag across all clients.
- [ ] Create `SophiaDevBot` for Telegram testing.
- [ ] Refactor API routes to use Dependency Injection for services.

### [Phase 2: CI/CD Pipeline Architecture](./phase-02-cicd-pipeline.md)
**Goal**: A GitHub Actions pipeline that verifies every commit.
- [ ] Set up Playwright with MSW (Mock Service Worker).
- [ ] Configure `ci-cd.yml` with Lint, Type-Check, Unit Test, E2E jobs.
- [ ] Implement Vercel Preview Deployments for PRs.
- [ ] Add "Production Gate" requiring 100% CI pass.

### [Phase 3: Deployment Automation](./phase-03-deployment-automation.md)
**Goal**: Single-command infrastructure setup and sync.
- [ ] Automate Vercel project linking and env sync.
- [ ] Script Supabase migrations and seed data for preview envs.
- [ ] Create `setup-polar.ts` for idempotent product syncing.

### [Phase 4: Production Verification (The Green Gate)](./phase-04-production-verification.md)
**Goal**: Automated post-deploy verification.
- [ ] Enhance `verify.sh` to check live endpoint health.
- [ ] Implement "Dry Run" production smoke tests (verify connectivity without cost).
- [ ] Add automated rollback triggers on health check failure.

## 🔗 Key Resources
- [Research: Deployment Tools](./research/researcher-01-deployment-automation-tools.md)
- [Research: Credentials & Mocks](./research/researcher-02-existing-credentials-mock-modes.md)
- [Research: CI/CD Strategy](./research/researcher-03-cicd-e2e-strategy.md)
