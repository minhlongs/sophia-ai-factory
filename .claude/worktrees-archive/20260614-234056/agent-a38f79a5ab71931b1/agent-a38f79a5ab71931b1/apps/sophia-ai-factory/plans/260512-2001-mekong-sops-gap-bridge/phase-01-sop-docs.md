# Phase 01 — Create Unified `docs/dev-sops.md`

## Context Links

- Mekong baseline: `plans/reports/researcher-260512-2001-mekong-architecture-baseline.md` (Section 1 — 10 SOPs)
- Sophia state: `plans/reports/researcher-260512-2001-sophia-current-state.md` (Section 2 — SOP gap matrix)
- Existing scattered SOPs: `docs/sop-ceo-production-smoke.md`, `docs/sophia-supervisor-agent-runbook.md`, `docs/payout-operations-runbook.md`, `docs/load-testing-runbook.md`
- Project doctrine: `apps/sophia-ai-factory/CLAUDE.md`, `.claude/rules/sophia-deploy-verify.md`

## Overview

- **Priority:** P2
- **Status:** completed
- **Effort:** M (3-4h) — actual ~3h
- **Description:** Create single canonical `docs/dev-sops.md` mirroring mekong's 10-section structure, adapted to sophia's Next.js 16 + CF Workers + npm + Better Auth stack. Index existing domain runbooks at appropriate sections.

## Key Insights

- Mekong has ONE `dev-sops.md` (197 lines); sophia has 5 fragmented files
- Sophia stack differs from mekong: Next.js (not FastAPI), CF Workers (not generic CF), npm (not pnpm), Better Auth (not custom JWT), Inngest (not PEV)
- Existing runbooks are domain-specific (CEO smoke, payout ops); SOP doc should link them, not duplicate
- CF-direct doctrine replaces Mekong SOP 5 (`pnpm wrangler dev/deploy`) with `npm run deploy:full + SHA verify`

## Requirements

### Functional
- Each SOP has: name, trigger, steps (numbered), acceptance check, link to deeper docs
- All commands use **npm** (not pnpm)
- All deploy references use `npm run deploy:full` + `/api/version` SHA match (per `sophia-deploy-verify.md`)
- Bilingual-friendly section headers (sophia client is non-tech CEO per `sophia-handover-rules.md`)

### Non-functional
- Single file ≤ 400 lines (split if exceeded — but target keep < 350)
- Self-contained: links to existing runbooks rather than copying content
- Indexable by Grep (clear section anchors)

## Related Code Files

### Files to Create
- `/Users/macbook/projects/sophia-ai-factory/apps/sophia-ai-factory/docs/dev-sops.md`

### Files to Modify
- `/Users/macbook/projects/sophia-ai-factory/apps/sophia-ai-factory/docs/project-changelog.md` (add entry: "feat(docs): unified dev-sops.md index")
- `/Users/macbook/projects/sophia-ai-factory/apps/sophia-ai-factory/CONTRIBUTING.md` (add link to dev-sops.md)
- `/Users/macbook/projects/sophia-ai-factory/apps/sophia-ai-factory/README.md` (add link in dev section if missing)

### Files to Reference (do NOT modify)
- `docs/sop-ceo-production-smoke.md`
- `docs/sophia-supervisor-agent-runbook.md`
- `docs/payout-operations-runbook.md`
- `docs/load-testing-runbook.md`
- `docs/deployment-guide.md`

## Implementation Steps

1. **Read existing scattered SOPs** to identify what content already exists vs needs new authorship.
   - `head -50` each runbook to extract: purpose, scope, key commands

2. **Draft `docs/dev-sops.md`** with these 10 sections (mirror mekong order, adapt content):
   - **SOP 1: Environment Setup**
     - Clone repo → `cd apps/sophia-ai-factory`
     - `npm install` (root + app)
     - Copy `.dev.vars.example` → `.dev.vars` (D1 binding, Better Auth secrets, NOWPayments keys)
     - `npx wrangler login` (one-time CF auth)
     - Verify: `npm run dev` boots :3000 + `npm test -- --run` exits 0
   - **SOP 2: Test Suite Execution**
     - `npm test` (watch) / `npm test -- --run` (CI mode) / `npm run test:coverage`
     - i18n validation auto-runs via `pretest` hook
     - E2E: `npm run test:e2e` (requires `NEXT_PUBLIC_MOCK_AI_SERVICES=true`)
     - Acceptance: 1398+/1398 pass, coverage ≥ existing baseline
   - **SOP 3: Add a New API Route**
     - Create `src/app/api/<route>/route.ts` with `GET/POST` handlers
     - Zod-validate inputs (project standard per `development-rules.md`)
     - Auth via `getCurrentUser()` from `@/lib/better-auth-session`
     - DB via `createServerClient()` (sync, no await)
     - Add test in `src/app/api/<route>/__tests__/route.test.ts`
     - Acceptance: `npm run build` 0 errors + `npm test` passes
   - **SOP 4: Modify Seed/Tree/Forest/Land Layers**
     - Reference: `.claude/rules/sophia-layer-architecture.md`
     - Import direction: `seed ← tree ← forest ← land` (with documented forest→land orchestration exception)
     - **NEVER** import `@/forest/*` or `@/tree/*` from `src/seed/**` (ESLint enforces per Phase 2)
     - Use canonical paths: `@/lib/better-auth-session`, `@/lib/db/client`, `@/config/tiers`
     - Add barrel exports for new public APIs (`<domain>/index.ts`)
   - **SOP 5: Deploy to Cloudflare Workers (CF-direct doctrine)**
     - `npm run deploy:full` (runs build + SHA injection + wrangler deploy)
     - Apply migrations if `migrations/*.sql` changed: `bash scripts/apply-migrations.sh`
     - **SHA-match verification (MANDATORY):**
       ```bash
       LOCAL=$(git rev-parse HEAD | cut -c1-8)
       LIVE=$(curl -s https://sophia.agencyos.network/api/version | jq -r .shortSha)
       [ "$LOCAL" = "$LIVE" ] && echo "MATCH" || echo "STALE"
       ```
     - Link to `.claude/rules/sophia-deploy-verify.md` for full sequence
   - **SOP 6: Git Workflow**
     - Branch: `feat/*`, `fix/*`, `refactor/*`, `docs/*`
     - Conventional commits: `feat: ...`, `fix(scope): ...`, `refactor: ...`
     - Pre-commit (husky, see SOP 9) blocks: lint errors, type errors, secrets
     - Pre-push runs full test suite
     - PR not required (CF-direct + solo dev) but use `gh pr create` for reviewed work
   - **SOP 7: Debug Issues**
     - Local: `npm run dev` + browser devtools
     - Production health: `curl https://sophia.agencyos.network/api/health` (auth-gated)
     - Production version: `curl https://sophia.agencyos.network/api/version` (public, returns shortSha)
     - Live logs: `npx wrangler tail` (CF Workers stream)
     - DB query: `npx wrangler d1 execute sophia-raas-db --remote --command "..."`
     - Doctor: `npm run doctor` (runs `scripts/sophia-doctor.mjs`)
   - **SOP 8: Project Structure Cheat Sheet**
     - 4-layer: `src/seed/` (147 files), `src/tree/` (162), `src/forest/` (362), `src/land/` (113)
     - Legacy: `src/lib/` (gradually migrating, OAuth callbacks exception)
     - Routes: `src/app/` (Next.js App Router)
     - Tests: colocated `__tests__/` + `src/__tests__/`
     - Migrations: `migrations/*.sql` (D1)
     - Scripts: `scripts/` (deploy-with-sha.sh, apply-migrations.sh, sophia-doctor.mjs)
     - Reference: `.claude/rules/sophia-layer-architecture.md`
   - **SOP 9: CI Gates (Local Enforcement — see Phase 02)**
     - **G1 typecheck:** `npm run type-check` (tsc --noEmit)
     - **G2 lint:** `npm run lint` (ESLint with --max-warnings=0)
     - **G3 test:** `npm test -- --run` (Vitest)
     - **G4 secret scan:** `npx secretlint "**/*"` (or `git secrets --scan` if installed)
     - **G5 audit:** `npm audit --audit-level=high`
     - Unified: `npm run ci` runs G1→G5 sequentially
     - Husky: pre-commit (G1 + G2 on staged) + pre-push (G3 + G5)
     - **NO GitHub Actions** (disabled by design 2026-05-03)
   - **SOP 10: Security Checklist**
     - No secrets in code (use `.dev.vars` locally, `wrangler secret put` in prod)
     - No `:any` types (project standard)
     - No `console.log` in production code
     - Zod validation on every API input
     - Better Auth session via `getCurrentUser()` (NEVER raw JWT parsing in routes)
     - **Banned imports:** `@/lib/auth`, `@/lib/subscription`, `@/lib/unified-tier-config`, `@/lib/tier-gate`
     - **Banned layer imports:** `@/forest/*` or `@/tree/*` from `src/seed/**`
     - Payment provider: NOWPayments (primary), PayOS (Vietnam backup). **Polar.sh + PayPal BANNED for Sophia.**
     - Webhook auth: HMAC verification on NOWPayments IPN

3. **Link existing runbooks** under each relevant SOP section (e.g., SOP 5 references `sop-ceo-production-smoke.md`).

4. **Add Changelog entry** in `docs/project-changelog.md`:
   ```
   ## 2026-05-12 — Mekong SOP Gap Bridge (Phase 1/3)
   feat(docs): Unified `docs/dev-sops.md` with 10 SOP sections adapted to CF-direct stack.
   Replaces scattered SOP files (kept as deep-dive runbooks linked from index).
   ```

5. **Update `CONTRIBUTING.md`** to point to `docs/dev-sops.md` as the canonical onboarding doc.

6. **Update `README.md`** (if it lacks a "Development" section, add one linking to dev-sops.md).

7. **Verify build still passes:** `npm run build` (docs change should not impact build, sanity check).

## Todo List

- [x] Read 4 existing runbooks (head -50 each) to map content
- [x] Draft `docs/dev-sops.md` with 10 sections (target < 350 lines) — 277 lines final
- [x] Verify all commands use `npm` (not pnpm)
- [x] Cross-link existing runbooks
- [x] Update `docs/project-changelog.md`
- [x] Update `CONTRIBUTING.md` with link to dev-sops.md
- [x] Update `README.md` Development section (if needed)
- [x] `npm run build` passes (sanity)
- [x] Commit: `docs: unified dev-sops.md (mekong SOP gap bridge phase 1)`
- [x] Deploy + SHA verify per `sophia-deploy-verify.md` (TBD commit SHA)

## Success Criteria

- File `docs/dev-sops.md` exists with 10 numbered SOP sections
- Each SOP has: name, trigger, steps, acceptance check
- All shell commands tested by manual copy-paste (no pnpm references)
- `grep -c "^## SOP" docs/dev-sops.md` returns 10
- CONTRIBUTING.md links to it
- `npm run build` exit 0 (no regression)

## Risk Assessment

- **LOW:** Docs-only change; cannot break runtime
- **Minor:** Outdated content if SOPs drift later → mitigate by adding a "Last reviewed: YYYY-MM-DD" header
- **Minor:** Risk of duplicating existing runbook content → mitigate by linking, not copy-pasting

## Security Considerations

- Do not document any actual secrets/keys (only env var NAMES)
- Reference `.dev.vars.example` (which lives in repo) for canonical env var list

## Rollback Strategy

- Single commit; revert via `git revert <sha>` if content is wrong
- Old scattered runbooks are NOT deleted in this phase — only indexed

## Next Steps

- Phase 02 implements the gates documented in SOP 9
- Phase 03 enforces the layer rules documented in SOP 4 + SOP 10
