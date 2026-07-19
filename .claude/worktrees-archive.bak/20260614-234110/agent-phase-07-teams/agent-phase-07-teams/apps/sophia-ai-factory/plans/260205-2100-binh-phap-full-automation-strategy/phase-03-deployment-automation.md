# Phase 3: Deployment Automation

**Priority**: High 🟠
**Status**: ✅ Completed
**Context**: [Master Plan](./plan.md)

## 🎯 Objective
Eliminate "magic" manual setup steps. Ensure that a new developer or a fresh environment can be spun up with a single command, and that infrastructure state is synced automatically.

## 🛠 Implementation Steps

### 1. Automate Polar Product Sync
- [x] **Refactor**: Convert `setup-polar-products.ts` into an idempotent script (`scripts/sync-polar.ts`) that runs in CI/Deployment.
- [x] **Logic**: Check if products exist -> Create if missing -> Update if changed.

### 2. Vercel Project Automation
- [x] **Script**: `scripts/setup-vercel.sh`
- [x] **Actions**:
    - Link project (if not linked).
    - Pull latest env vars.
    - Configure build settings (if needed).

### 3. Supabase Infrastructure as Code
- [x] **Migrations**: Ensure all DB schema changes are in `supabase/migrations`.
- [x] **Seed**: Create `supabase/seed.sql` for reproducible local/preview data.
- [x] **CI**: Add `supabase db push` (or verify) step to pipeline for migrations.

### 4. "One-Click" Setup Script
- [x] **Enhance**: Update `scripts/setup.sh` to call these specific automation scripts sequentially.
- [x] **Flags**: Add `--yes` or `--ci` flags to all scripts to bypass interactive prompts for automated execution.

## ✅ Definition of Done
- [x] `npm run infra:sync` syncs Polar products and Supabase schema without user intervention.
- [x] New developers can run `npm run setup --ci` to get a fully working environment.
- [x] Production deployment (Vercel) automatically runs migration checks (or we have a safe process for it).
