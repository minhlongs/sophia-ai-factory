# Phase 3: Deployment Automation

**Priority**: High 🟠
**Status**: Pending
**Context**: [Master Plan](./plan.md)

## 🎯 Objective
Eliminate "magic" manual setup steps. Ensure that a new developer or a fresh environment can be spun up with a single command, and that infrastructure state is synced automatically.

## 🔍 Key Insights (from Research)
- **Vercel CLI**: Can automate project linking and env management.
- **Polar SDK**: Can programmatically create/sync products (`setup-polar-products.ts` exists but needs full automation).
- **Supabase**: `supabase link` and `db push` are robust, but local seed data is often missing.
- **Current Gap**: "Production Setup" is currently an interactive wizard (`scripts/production-setup.ts`). We need a non-interactive, idempotent "Apply" mode.

## 🛠 Implementation Steps

### 1. Automate Polar Product Sync
- **Refactor**: Convert `setup-polar-products.ts` into an idempotent script (`scripts/sync-polar.ts`) that runs in CI/Deployment.
- **Logic**: Check if products exist -> Create if missing -> Update if changed.

### 2. Vercel Project Automation
- **Script**: `scripts/setup-vercel.sh`
- **Actions**:
    - Link project (if not linked).
    - Pull latest env vars.
    - Configure build settings (if needed).

### 3. Supabase Infrastructure as Code
- **Migrations**: Ensure all DB schema changes are in `supabase/migrations`.
- **Seed**: Create `supabase/seed.sql` for reproducible local/preview data.
- **CI**: Add `supabase db push` (or verify) step to pipeline for migrations.

### 4. "One-Click" Setup Script
- **Enhance**: Update `scripts/setup.sh` to call these specific automation scripts sequentially.
- **Flags**: Add `--yes` or `--ci` flags to all scripts to bypass interactive prompts for automated execution.

## ✅ Definition of Done
- [ ] `npm run infra:sync` syncs Polar products and Supabase schema without user intervention.
- [ ] New developers can run `npm run setup --ci` to get a fully working environment.
- [ ] Production deployment (Vercel) automatically runs migration checks (or we have a safe process for it).

## 🛡️ Risk Assessment
- **Risk**: Accidental overwrites of production data.
- **Mitigation**: Strict environment checks (`if (NODE_ENV === 'production') ...`). Use separate service accounts/keys for CI with limited permissions where possible.
