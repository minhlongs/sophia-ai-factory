# Docs Backfill Current-State Pass

**Date:** 2026-05-21  
**Plan:** `plans/260520-2151-docs-harness-alignment/`  
**Scope:** root README + root docs drift cleanup after CAAMP/AGENTS harness install; continuation covered historical migration notes and pricing/tier handover drift.

## Evidence Read

- Project rules: `AGENTS.md`, `CLAUDE.md`, `.claude/rules/development-rules.md`, `.claude/rules/documentation-management.md`.
- App rules: `apps/sophia-ai-factory/CLAUDE.md`, `apps/sophia-ai-factory/README.md`.
- App package: `apps/sophia-ai-factory/package.json`.
- Deploy config: `apps/sophia-ai-factory/wrangler.toml`, `apps/sophia-ai-factory/scripts/deploy-with-sha.sh`.
- Backup path: `apps/sophia-ai-factory/src/app/api/cron/d1-backup/route.ts`.
- Cron injection: `apps/sophia-ai-factory/scripts/inject-scheduled-handler.mjs`.
- Cron heartbeat: `apps/sophia-ai-factory/src/app/api/health/cron-heartbeat/route.ts`.
- Optional rollback workflow: `.github/workflows/canary-rollback.yml`.
- Pricing source of truth: `apps/sophia-ai-factory/src/seed/config/tiers/unified-limits.ts`, `apps/sophia-ai-factory/src/seed/config/tiers/tier-configs.ts`, `apps/sophia-ai-factory/src/forest/components/pricing/pricing-data.ts`, `apps/sophia-ai-factory/src/forest/components/pricing/pricing-comparison-table.tsx`.
- Handover tier content generator: `apps/sophia-ai-factory/src/tree/handover/handover-tier-content.ts`, `apps/sophia-ai-factory/src/tree/handover/handover-doc-generator.ts`.
- Historical migration docs: `docs/migrations/MIGRATION_CHECKLIST.md`, `docs/migrations/REDIS_TO_SUPABASE.md`.

## Current Facts Verified

| Fact | Evidence |
|---|---|
| Main app lives in `apps/sophia-ai-factory/` | root README + app package |
| Runtime deploy target is Cloudflare Workers/OpenNext | `wrangler.toml`, app CLAUDE |
| Canonical deploy is CF-direct | `deploy-with-sha.sh`, app CLAUDE |
| GitHub Actions deploy is disabled | `.github/workflows/test.yml.disabled`, app CLAUDE |
| App stack is Next.js 16 + React 19 | app `package.json` |
| D1 migrations count is 120 SQL files, highest numbered 0117 | `find apps/sophia-ai-factory/migrations -name '*.sql'` |
| Vitest surface has 475 test files under app `src/` | `find apps/sophia-ai-factory/src -name '*.test.ts*'` |
| D1 backup writes to R2 via `/api/cron/d1-backup` | route source + `BACKUPS_BUCKET` binding |
| `npm run deploy:full` injects `COMMIT_SHA`, `DEPLOYED_AT`, and `DEPLOY_BRANCH` Worker secrets | `scripts/deploy-with-sha.sh` |
| Several `wrangler.toml` cron patterns are not mapped by `CRON_ROUTES` | `wrangler.toml` compared with `inject-scheduled-handler.mjs` |
| Pricing UI and comparison table read `UNIFIED_TIERS` | pricing components import `UNIFIED_TIERS` |
| Canonical display tiers are Starter/BASIC, Growth/PREMIUM, Premium/ENTERPRISE, Master/MASTER | `unified-limits.ts`, `tier-configs.ts` |
| Canonical campaign limits are 10, 50, unlimited, unlimited | `UNIFIED_TIERS[*].campaignsPerMonth` |
| Canonical MCU limits are 1,000, 5,000, 20,000, 100,000 | `UNIFIED_TIERS[*].mcuMonthly` |
| Master billing is lifetime/one-time, not monthly | `UNIFIED_TIERS.MASTER.billingType`; generator now derives `TIER_PRICES` and `TIER_BILLING_TERMS` from canonical config |
| Old RaaS migration docs reference missing artifacts | no `docs/migrations/raas-licenses-schema.sql`; no `scripts/deploy-raas-migration.sh` |

## Files Backfilled This Pass

- `README.md` — removed live GitHub Actions deploy claim and stale 863-test claim.
- `docs/project-overview-pdr.md` — converted current status claims to last-GREEN snapshots; corrected migration count.
- `docs/codebase-summary.md` — corrected Next/React version, deploy flow, migration count, testing section, links, and workflow notes.
- `docs/system-architecture.md` — corrected deploy layer, framework version, cron auth path, backup path, verification rules.
- `docs/deployment-guide.md` — corrected cron/D1 backup exception and migration count.
- `docs/cloud-infrastructure.md` — replaced CI deploy flow with CF-direct flow and SHA verification.
- `docs/cloud-infrastructure.md` — deep-refreshed Cloudflare bindings, D1/R2 inventory, migration count, backup route, and verification checklist.
- `docs/disaster-recovery.md` — replaced GitHub Actions backup/redeploy instructions with R2 backup + CF-direct deploy.
- `docs/credentials-handover.md` — updated deploy/auth checklist.
- `docs/customer-handover-runbook.md` — updated outage triage step.
- `docs/development-roadmap.md` — marked old GitHub Actions items historical/superseded.
- `docs/code-standards.md` — removed Polar metadata wording from NOWPayments SKU pattern.
- `docs/sophia-activation-runbook.md` — replaced GH Actions activation path with CF-direct deploy prereqs, Worker secrets, deploy SHA smoke, and optional GH rollback notes.
- `docs/secret-rotation-runbook.md` — aligned partial runbook with Worker-secret-first rotation and optional GH workflows.
- `docs/runbooks/secret-rotation-runbook.md` — aligned canonical runbook with Worker-secret-first rotation and external scheduler note.
- `docs/runbooks/cron-escalation-contacts.md` — refreshed cron schedule table from current injected route map; recorded unmapped `wrangler.toml` patterns.
- `docs/sophia-mekong-integration.md` — refreshed Sophia side from GH Actions CI/CD gates to CF-direct deploy gates.
- `docs/README.md` — clarified runbook index, legacy top-level secret runbook, launch draft scope, and historical migration note scope.
- `docs/handover-documentation-index.md` — fixed missing `design-guidelines.md` link and aligned tier table to `UNIFIED_TIERS`.
- `docs/migrations/MIGRATION_CHECKLIST.md` — marked historical; replaced Vercel/GitHub deploy steps with current CF-direct references.
- `docs/migrations/REDIS_TO_SUPABASE.md` — marked historical; replaced Vercel/current-run instructions with CF-direct references and missing-artifact notes.
- `docs/pricing-and-tiers.md` — aligned campaigns, MCU, API access, support SLA, and Master one-time billing to `UNIFIED_TIERS`.
- `docs/faq.md` — aligned campaign/MCU tier answers to `UNIFIED_TIERS`.
- `docs/handover/terms-of-service-vi-en.md` — aligned tier entitlement tables and fixed Master monthly wording.
- `docs/handover/refund-policy-vi-en.md` — aligned MCU allowance tables and removed stale per-video price promises.
- `docs/handover/welcome-email-template-vi-en.md` — removed old `[50/200/unlimited]` entitlement placeholders and fixed Master billing.
- `docs/handover/roi-calculator-guide-vi-en.md` — aligned ROI pricing tier table and removed old pay-as-you-go video-limit wording.
- `apps/sophia-ai-factory/src/tree/handover/handover-tier-content.ts` — fixed generated handover tier prices and billing terms to derive from `UNIFIED_TIERS`.
- `apps/sophia-ai-factory/src/tree/handover/handover-doc-generator.ts` — fixed contract billing row so Master renders as one-time/lifetime instead of monthly auto-renew.
- `apps/sophia-ai-factory/src/tree/handover/handover-tier-content.test.ts` — pinned subscription tiers as `/mo` and Master as one-time.
- `apps/sophia-ai-factory/src/tree/handover/handover-doc-generator.test.ts` — pinned Master contract billing output.
- `.claude/scripts/validate-docs.cjs` — made docs discovery recursive, skipped archive directories by default, replaced per-reference `grep` subprocesses with a one-time source index, skipped `.claude/worktrees`, and loaded root/app env examples.

## Validation

- `git diff --check` — pass.
- Internal links in touched docs — pass via Node link check.
- Stale-pattern sweep on touched docs — pass for live-instruction drift; remaining GitHub Actions mentions are doctrine/historical/disabled-file references.
- Second-pass stale sweep — pass for canonical-path drift; remaining matches are explicit doctrine/historical/optional-workflow references.
- Pricing/tier stale sweep — pass for entitlement drift; remaining `videos/month` matches in ROI guide are calculator inputs, not plan limits.
- Internal links across `docs/` excluding `docs/archive/` — pass after continuation patches.
- `npx vitest run src/tree/handover/handover-tier-content.test.ts src/tree/handover/handover-doc-generator.test.ts` — pass, 41 tests.
- `npm run type-check` in `apps/sophia-ai-factory` — pass.
- `node .claude/scripts/validate-docs.cjs docs` — pass in warn-only mode; 64 current docs checked, 94 internal links working, 136 code refs validated, 97 config keys confirmed. Remaining warnings are mostly changelog/historical reference drift.

## Remaining Gaps

- Full root `docs/` still has historical launch/changelog/report files mentioning old providers and GitHub Actions; these are mostly history, not live operator instructions.
- `docs/cloud-infrastructure.md` still has estimated cost/limit data that should be checked against the Cloudflare dashboard before external publication.
- `docs/development-roadmap.md` is still broad historical record; only live doctrine contradictions were patched.
- Cron schedule drift found: `error-digest`, `heartbeat`, `llm-cache-purge`, `wallet-rebuild`, and `affiliate-scout` appear in `wrangler.toml` comments/patterns but are absent from `CRON_ROUTES`.
- Docs validator now finishes, but its warning model is noisy on changelog/history docs; next improvement should add category-aware filters or severity levels.

## Unresolved Questions

- Should `docs/cloud-infrastructure.md` become a live infra inventory with dated verification commands, or remain a narrative/audit doc?
- Should historical launch copy that mentions Stripe Connect stay as launch-positioning history, or move under `docs/archive/launch/`?
