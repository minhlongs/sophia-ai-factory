# Phase 01 — Audit & Worktree Cleanup

## Context Links
- Brainstorm: [reports/brainstorm.md](reports/brainstorm.md) §2.5, §6 D1
- Memory: `~/.claude/projects/-Users-macbook/memory/project_sophia_consolidation.md`
- Doctrine: `.claude/rules/sophia-no-tech-doctrine.md`
- Deploy verify: `apps/sophia-ai-factory/.claude/rules/sophia-deploy-verify.md`

## Overview
- **Priority:** P0 (blocker for all subsequent phases)
- **Status:** pending
- **Duration:** ~1 day (D1)
- **Brief:** Archive stale worktree, verify baseline (tests/lint/seed), inventory dashboard bugs, confirm NOWPayments secrets wired.

## Key Insights
- Two worktrees diverged: canon `~/projects/sophia-ai-factory/` HEAD `05b62157` vs stale `~/sophia-ai-factory/` HEAD `b0b34ffd` (independent commits) → risk of cd-mistake in future session.
- Promo system fully built; only seed presence in PROD D1 must be confirmed before relying on it for FREE100-XXXX expansion.
- 1,444 tests, ESLint 0 errors + 423 warnings = baseline to preserve.

## Requirements
**Functional:**
- Archive duplicate worktree with safety check
- Verify baseline test/lint state
- Confirm PROD D1 has at least 1 active FREE100 row
- Inventory dashboard route bugs
- Confirm NOWPayments creds present as CF Worker secrets

**Non-functional:**
- Zero downtime (no prod changes in this phase)
- All work read-only against PROD

## Architecture
Read-only audit phase. Touches local filesystem (worktree archive), local repo (test/lint), PROD D1 (SELECT only), and CF secrets list (read-only). No deploy.

## Related Code Files
**Modify:**
- `docs/known-issues.md` (create or append inventory)
- `~/.claude/projects/-Users-macbook/memory/project_sophia_consolidation.md` (append audit timestamp + SHA confirmation)

**Create:**
- `~/sophia-ai-factory.archived-260517/.archived/STOP-DO-NOT-USE` (marker file)
- `plans/260517-2223-sophia-free100-handover/reports/phase-01-audit-report.md`

**Delete:** none (we archive, never delete)

## Implementation Steps

### 1. Verify no active session on stale worktree
```bash
lsof +D ~/sophia-ai-factory 2>/dev/null | head -20
# If any active claude/node/wrangler process → STOP, coordinate with user
```

### 2. Archive stale worktree
```bash
mv ~/sophia-ai-factory ~/sophia-ai-factory.archived-260517
mkdir -p ~/sophia-ai-factory.archived-260517/.archived
cat > ~/sophia-ai-factory.archived-260517/.archived/STOP-DO-NOT-USE <<EOF
ARCHIVED 2026-05-17 — DO NOT USE
Canonical path: ~/projects/sophia-ai-factory/
Stale HEAD at archive: b0b34ffd
Reason: divergent commits never pushed to origin; risk of session cd-mistake.
EOF
```

### 3. Confirm canonical HEAD
```bash
cd /Users/macbook/projects/sophia-ai-factory/apps/sophia-ai-factory
git rev-parse HEAD | cut -c1-8  # expect 05b62157
git status                       # expect clean
```

### 4. Run full test suite
```bash
cd /Users/macbook/projects/sophia-ai-factory/apps/sophia-ai-factory
pnpm test 2>&1 | tee /tmp/phase-01-tests.log
# expect: 1444 pass, 0 fail
```

### 5. ESLint baseline check
```bash
pnpm lint 2>&1 | tee /tmp/phase-01-lint.log
# expect: 0 errors, ~423 warnings
```

### 6. Verify FREE100 seed in PROD D1
```bash
cd /Users/macbook/projects/sophia-ai-factory/apps/sophia-ai-factory
npx wrangler d1 execute sophia-raas-db --remote \
  --command "SELECT id, code, discount_type, applies_to_tier, max_uses, max_uses_per_user, status FROM promo_codes WHERE code LIKE 'FREE100%'"
# expect: ≥1 row with status='active', discount_type='free_full', applies_to_tier='master'
# If 0 rows → flag as blocker; apply migration 0067 to PROD
```

### 7. Verify NOWPayments secrets wired
```bash
npx wrangler secret list --name sophia-ai-factory | grep -i nowpayments
# expect: NOWPAYMENTS_API_KEY, NOWPAYMENTS_IPN_SECRET
```

### 8. Browser smoke test 20 dashboard routes
Open https://sophia.agencyos.network with admin login. Walk every route under `/dashboard/*`. For each: note 200/non-200, console errors, missing i18n keys, broken layouts.

Routes to test (from `src/app/[locale]/dashboard/`):
- `/dashboard`, `/dashboard/billing`, `/dashboard/byok`, `/dashboard/campaigns`, `/dashboard/handover`, `/dashboard/profile`, `/dashboard/settings`, `/dashboard/admin/*` (sub-routes), `/dashboard/usage`, `/dashboard/affiliates`, `/dashboard/payouts`, etc.

Inventory results → `docs/known-issues.md` table: `| Route | Severity (P0/P1/P2) | Symptom | Notes |`.

### 9. Write phase-01 report
```bash
cat > plans/260517-2223-sophia-free100-handover/reports/phase-01-audit-report.md <<EOF
# Phase 01 Audit Report — 2026-05-17

## Baseline
- HEAD: <sha>
- Tests: <pass>/<total>
- Lint: <errors>e/<warnings>w
- FREE100 seed: <count> rows in PROD D1
- Worktree archived: ~/sophia-ai-factory → ~/sophia-ai-factory.archived-260517
- NOWPayments secrets: <list>

## Dashboard Issues Inventory
<table from step 8>

## Blockers for Phase 02
<list or "none">
EOF
```

## Todo List
- [x] Verify no active session on stale worktree (`lsof` empty 2026-05-17 22:55)
- [x] Salvage 4 untracked files from stale → canon (user-decided)
- [x] Archive `~/sophia-ai-factory` → `~/sophia-ai-factory.archived-260517` with marker file
- [x] Confirm canon HEAD `05b62157` clean
- [x] Run `npm test` → **4,446 pass / 32 skipped** (memory's 1,444 was stale)
- [x] Run `npm run lint` → **0 errors, 340 warnings** (baseline was 423)
- [x] Verify FREE100 seed in PROD D1 (1 active row: 50 slots, MASTER tier, free_full)
- [x] Verify NOWPayments secrets via `wrangler secret list` (API_KEY + IPN_SECRET + WALLET)
- [x] Verify PROD deploy SHA match local HEAD (`05b62157` ↔ `05b62157`)
- [~] Browser smoke test 20 dashboard routes — PARTIAL (curl 307/200 baseline ✅, auth-browser walk deferred → Phase 08)
- [x] Append findings to `docs/known-issues.md`
- [x] Write `reports/phase-01-audit-report.md`

## Success Criteria
- Stale worktree archived with marker file in place
- Baseline confirmed: 1,444 tests pass, 0 lint errors
- FREE100 seed verified in PROD D1
- NOWPayments secrets present
- All 20 dashboard routes inventoried (issues categorized P0/P1/P2)
- Phase 01 audit report written

## Risk Assessment
| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| lsof catches active session on stale path | Low | Med | Pause + ask user before mv |
| FREE100 seed absent in PROD | Med | High | Apply migration 0067 before Phase 03 |
| `pnpm test` reveals regression | Low | High | Fix before any other work; do NOT proceed to Phase 02 |
| Dashboard route reveals P0 bug | Med | Med | Triage: P0 fix immediately, P1 backlog, P2 document |

## Security Considerations
- Read-only PROD D1 queries only (no INSERT/UPDATE)
- `wrangler secret list` returns secret NAMES only, never values
- Worktree archive uses `mv` (atomic, no data loss)
- No credentials added to commits

## Next Steps
- Phase 02 (staging setup) unblocks pen test (05), DR drill (07), load test (08)
- If FREE100 seed missing → escalate before Phase 03 begins
- If P0 dashboard bug found → fix in this phase before D2
