# Plan — Harness Engineering System

This document outlines the execution plan for implementing the Harness Engineering system for Sophia AI Factory, based on the approved system design in `docs/plans/2026-05-30-harness-engineering-design.md`.

## Implementation Strategy

We will work within the pre-established Git worktree for `feature/harness-engineering` located at `/Users/macbook/projects/sophia-ai-factory/.claude/worktrees/feature-harness-engineering`.

All worker tasks, builds, lint checks, and test runs must run within this worktree context.

## Milestones

### Phase 1: Setup & Initialization
- **Goal**: Git branch configuration check & write detailed plan/scope.
- **Verification**: Ensure worktree is clean, status checked, and plan.md and SCOPE.md are recorded.

### Milestone 1: Database Migrations (D1)
- **Goal**: Create and apply SQLite D1 database migration file to provision `harness_jobs` and `harness_results` tables.
- **Output File**: `migrations/0148_harness_engineering.sql` (renamed from `0148_harness_tables.sql` to match instructions, or verified).
- **Verification**:
  - Run wrangler migration dry-run or execute table checks.
  - Verify tables exist with correct columns and check constraints.

### Milestone 2: API Gateway Route Handlers (Edge Runtime)
- **Goal**: Implement Next.js Edge route handlers for job triggering, polling, and patching.
- **Output Files**:
  - `apps/sophia-ai-factory/src/app/api/v1/harness/trigger/route.ts`
  - `apps/sophia-ai-factory/src/app/api/v1/harness/jobs/poll/route.ts`
  - `apps/sophia-ai-factory/src/app/api/v1/harness/jobs/[id]/route.ts`
- **Verification**:
  - Run `npx vitest run src/app/api/v1/harness/__tests__/route.test.ts`
  - Ensure Edge runtime export is set on the routes.

### Milestone 3: Local Daemon Script
- **Goal**: Implement the local Node.js/TypeScript daemon polling loop and 5 checks:
  1. D1 Ping (light `/api/health` call)
  2. R2 write/delete test blob
  3. API check: OpenRouter, HeyGen, ElevenLabs validation hooks
  4. Local Remotion video composite CLI compilation child process
- **Output File**: `apps/sophia-ai-factory/src/tree/harness/daemon.ts`
- **Verification**:
  - Run daemon locally (mocked or dry-run) to ensure polling loop and checks complete successfully.
  - Ensure status transition of jobs (`pending` -> `processing` -> `completed`/`failed`) works properly.

### Milestone 4: Multi-Channel UI Widgets
- **Goal**: Implement settings dashboard React widget and Telegram webhook slash commands.
- **Output Files**:
  - React widget in `apps/sophia-ai-factory/src/app/[locale]/dashboard/settings/customize/customize-page-client.tsx`
  - `/status` and `/audit` slash commands in `apps/sophia-ai-factory/src/app/api/webhooks/telegram/route.ts`
- **Verification**:
  - Build UI code and check for compilation errors.
  - Test botwebhook parser to ensure commands correctly trigger jobs.

### Milestone 5: E2E and Unit Test Verification & Code Quality
- **Goal**: Run complete test suite and code quality gates.
- **Verification**:
  - Run `tsc --noEmit` and check for type correctness.
  - Run `npm run ci:lint` and check for lint errors.
  - Run `npm run ci:test` for Vitest tests.
  - Run Forensic Auditor to perform full integrity audits.
