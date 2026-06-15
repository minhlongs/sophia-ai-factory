---
template: deployment-checklist
phase: 4-deploy
version: "1.0"
---

# Deployment Checklist: {Feature / PR Title}

> Complete ALL items before reporting "done". Missing any item = deploy not finished.

## Meta

| Field | Value |
|-------|-------|
| Date | {YYYY-MM-DD HH:MM} |
| Feature | {feature name} |
| PR | {link to GitHub PR} |
| Commit SHA | {sha} |
| Deployer | CTO agent / sophia-orchestrator |

---

## Pre-Deploy Gates

### Code Quality
- [ ] `npm run typecheck` — exit 0, 0 errors
- [ ] `npm test` — all {N} tests pass
- [ ] `npm run build` — exit 0
- [ ] `grep -r ": any" src | wc -l` — result: 0
- [ ] `grep -r "console\." src | wc -l` — result: 0

### PR & Branch
- [ ] PR approved (or self-merge with founder token)
- [ ] PR merged to `main` (not just approved)
- [ ] Feature branch up-to-date with main before merge
- [ ] No merge conflicts

### Protected Flows
- [ ] Setup Wizard — manual smoke test: {pass / N/A}
- [ ] Telegram Bot — `/start` responds: {pass / N/A}
- [ ] NOWPayments webhook — `/api/webhooks/nowpayments` reachable: {pass / N/A}

### Environment Variables
- [ ] New env vars added to CF Dashboard → Secrets: {list or None}
- [ ] No secrets committed to repo
- [ ] `.env` not in git diff

---

## Deploy Execution

### GitHub Actions
- [ ] CI triggered on push to `main`
- [ ] GitHub Actions status: {success / failure}
- [ ] CF Pages deploy triggered by CI
- [ ] CF Pages deploy status: {success / failure}
- [ ] Deploy duration: {Xs}

### Manual Deploy (if needed)
```bash
# Only if GitHub Actions fails — founder executes
wrangler pages deploy .next --project-name sophia-ai-factory
```
- [ ] Manual deploy executed: {yes / N/A}
- [ ] Manual deploy status: {success / N/A}

---

## Post-Deploy Verification

### Production Health
- [ ] `curl -sI https://sophia.agencyos.network | head -1` → HTTP 200
- [ ] `/api/health` → `{"status":"ok"}`
- [ ] `/api/version` → commit SHA matches: `{sha}`

### Feature Smoke Test
- [ ] {Test case 1 — happy path}: {result}
- [ ] {Test case 2 — auth gate}: {result}
- [ ] {Test case 3 — error state}: {result}
- [ ] Bilingual labels display correctly: {yes / N/A}
- [ ] Tier gate enforced (wrong tier → 403): {yes / N/A}

### Canary (if P1 active)
- [ ] Canary error rate checked: {rate% — acceptable if < 2x stable}
- [ ] Rollback decision: {not needed / recommended}

---

## Completion Report

```
## Verification Report
- Build: ✅ exit code 0
- Tests: ✅ {N} tests passed
- Git Push: ✅ {commit_sha} → main
- CI/CD: ✅ GitHub Actions success
- Deploy: ✅ CF Pages deployed
- Production: ✅ HTTP 200
- Feature: ✅ smoke tests passed
- Timestamp: {YYYY-MM-DD HH:MM UTC}
```

## Issues Encountered

{None / describe any issues and how resolved}

## Rollback Instructions (if needed)

```bash
# Founder executes — CTO agent MUST NOT run this without founder token
wrangler rollback --project-name sophia-ai-factory
# Then: git revert {commit_sha} && git push origin main
```

---
*Template version 1.0 — Sophia AI Factory Phase 4 Deployment Checklist*
