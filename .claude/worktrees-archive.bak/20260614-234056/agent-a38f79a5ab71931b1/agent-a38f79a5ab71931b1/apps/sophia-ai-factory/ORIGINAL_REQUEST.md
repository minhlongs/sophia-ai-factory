# Original User Request

## Initial Request — 2026-05-29T23:51:40-07:00

Build R2 BYOS Settings UI and Local Setup Guide Dashboard for Sophia AI Factory.

Working directory: /Users/macbook/projects/sophia-ai-factory/apps/sophia-ai-factory
Integrity mode: development

## Requirements

### R1. Storage Settings Form (R2 BYOS)
Add a configuration form under Dashboard settings allowing CEO Media to input their Cloudflare R2 credentials (r2AccessKeyId, r2SecretAccessKey, r2BucketName, r2Endpoint, r2PublicBaseUrl, and a toggle for useTenantStorage). 
Persist these configurations securely in the 'storage' tenant settings namespace via the existing API route `/api/v1/settings/storage`.

### R2. Local Engine Setup Guide
Display a clear, step-by-step "Zero-Config Setup Guide" for local rendering on the dashboard. It must show the shell command to download and run the installer:
`curl -s https://platform.sophia.ai/install-m1.sh | bash`
Provide a copy-to-clipboard button next to the command and display the user's connection API key.

## Acceptance Criteria

### Verification
- [ ] Settings form successfully loads and saves R2 configurations to the SQLite D1 database.
- [ ] User credentials inputs (Keys) are obfuscated or masked in the UI after saving.
- [ ] Setup guide displays the correct curl command and includes a working copy button.
- [ ] TypeScript compilation (`npx tsc --noEmit`) passes with zero errors.

## Follow-up — 2026-05-30T02:56:06-07:00

Fix all backend ↔ frontend synchronization issues in the SOP (Standard Operating Procedures) system so that the CEO has a fully functional SOP dashboard to operate the business. The SOPs module is a core revenue feature: users install SOPs (automated playbooks), run them, and optionally sell custom SOPs on a marketplace.

Working directory: /Users/macbook/projects/sophia-ai-factory/apps/sophia-ai-factory
Integrity mode: development

## Audit Findings (from dual scout investigation)

### 🔴 Critical Desync Issues

1. **Sidebar navigation missing** — All 3 SOP pages (`/sops`, `/sop-marketplace`, `/sop-creator`) have ZERO entries in `dashboard-sidebar-nav.tsx`. CEO literally cannot find SOPs from the dashboard. Users only reach SOPs via onboarding tour or quick-action cards.

2. **Dual execution systems** — Two parallel execution tables exist:
   - `sop_runs` (migration 0057) — used by `src/lib/sop/` repo layer
   - `sop_executions` (migration 0125) — used by `src/forest/sops/sop-executor.ts` + `src/seed/db/repositories/`
   
   This means some execution data may be written to one table but read from the other.

3. **Dual repo layers** — Two separate data access layers exist for the same domain:
   - **Primary**: `src/lib/sop/sop-repo-*.ts` (4 files, 28 functions) — used by all dashboard pages
   - **Secondary**: `src/seed/db/repositories/sop-*.ts` + `src/forest/sops/sop-executor.ts` — used by executor, publish-video-action
   
   These may return different data shapes or query different tables for the same concept.

### 🟡 Incomplete Wiring

4. **Challenges page partially wired** — `sop_challenges` + `user_challenge_progress` tables exist (0123), types defined, backend logic in `land/sop-marketplace/challenges.ts`, page at `/dashboard/challenges/`. But integration between page ↔ backend may be incomplete.

5. **Creator sales visibility** — `listCreatorSales()` and `listUserLicenses()` are exported but have no confirmed direct frontend usage. Creator dashboard shows sales but uses `getCreatorEarnings()` from a different module.

6. **Execution analytics orphaned** — `sop_execution_logs` (0127) has a repo file (`sop-execution-log-repo.ts`) but no frontend page. `sop_execution_metrics` table has zero frontend references.

### 🟢 Confirmed Working (do not break)

- All 8 SOP pages render correctly
- All 15 forest/sop components are dynamic with correct types
- All 28 repo functions are properly exported via barrel
- All 10 server actions are wired to their UI triggers
- SopRunTimeline polling works via `/api/sop/runs/[runId]`
- Marketplace purchase flow (browse → buy → license → install)
- i18n translations (en.json + vi.json) for all SOP pages

## Requirements

### R1. Sidebar Navigation — SOPs Must Be Discoverable

Add SOP entries to `dashboard-sidebar-nav.tsx` so the CEO can navigate to SOPs from any dashboard page. The test file `sidebar-nav.test.tsx` already references `sidebar.sop_marketplace` and `sidebar.my_sops` translation keys — these were planned but never implemented. The SOP creator entry should only appear for MASTER-tier users.

### R2. Execution System Alignment

Resolve the dual execution system (`sop_runs` vs `sop_executions`). Determine which is canonical, ensure all write paths go to the same table, and all read paths query the same table. If `sop_executions` is the newer/better schema, migrate reads to it. If `sop_runs` is canonical, ensure the forest executor writes to it. Document the decision.

### R3. Challenges Page End-to-End Wiring

Verify and complete the challenges page at `/dashboard/challenges/`. Ensure:
- The page fetches active challenges from D1 (`sop_challenges`)
- User progress is tracked and displayed (`user_challenge_progress`)
- Reward claims work
- Page is accessible from sidebar navigation

If the challenges feature is too incomplete for MVP, add a feature-flag to hide it and document what's missing.

### R4. Execution Analytics Visibility

Wire the `sop_execution_logs` data to a visible UI — either as a tab in the SOP installation detail page or as a separate analytics page. The CEO needs to see which SOPs run successfully, which fail, and how long they take.

### R5. No Regressions

All existing SOP functionality (marketplace browse/install/purchase, creator create/publish, installation run/edit/delete, run timeline polling) must continue working. The 93 existing SOP tests must pass.

## Acceptance Criteria

### Navigation
- [ ] `dashboard-sidebar-nav.tsx` contains entries for "My SOPs" → `/dashboard/sops` and "SOP Marketplace" → `/dashboard/sop-marketplace`
- [ ] SOP Creator entry appears only for MASTER-tier users
- [ ] Translation keys exist in both `en.json` and `vi.json`
- [ ] Sidebar test (`sidebar-nav.test.tsx`) passes with the new entries

### Execution Alignment
- [ ] A single execution table is used for all SOP run writes and reads
- [ ] The executor (`sop-executor.ts` or `sop-runner.ts`) writes to the canonical table
- [ ] The run detail page and timeline read from the canonical table
- [ ] No data is lost in the alignment (if migration needed, it's documented)

### Challenges
- [ ] `/dashboard/challenges` page loads without errors
- [ ] Active challenges display with progress bars
- [ ] OR: challenges feature is behind a feature flag with documentation of remaining work

### Analytics
- [ ] SOP installation detail page shows execution history with status, duration, and step results
- [ ] OR: a dedicated analytics tab/page exists for SOP run history

### Regression
- [ ] All 93 existing SOP tests pass (`npx vitest run src/forest/components/sop/ src/lib/sop/`)
- [ ] `npx tsc --noEmit` returns 0 errors
- [ ] All 8 existing SOP pages return 200 or 307 (auth redirect) on production
