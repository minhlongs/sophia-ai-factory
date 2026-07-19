## 2026-05-29T23:51:40Z

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

## 2026-05-30T02:56:06Z

Fix all backend ↔ frontend synchronization issues in the SOP (Standard Operating Procedures) system so that the CEO has a fully functional SOP dashboard to operate the business. The SOPs module is a core revenue feature: users install SOPs (automated playbooks), run them, and optionally sell custom SOPs on a marketplace.

Working directory: /Users/macbook/projects/sophia-ai-factory/apps/sophia-ai-factory
Integrity mode: development

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

