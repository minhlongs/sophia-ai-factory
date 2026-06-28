---
phase: 4
title: "Deploy — Ship + Verify"
description: |
  [VN] Giai đoạn 4: Deploy lên production và xác nhận hệ thống hoạt động đúng. Output là production green + journal entry.
  [EN] Phase 4: Deploy to production and verify system health. Output is production green + journal entry.
input: "Merged PR from Phase 3"
output: "Production green, journal entry written, ops notified"
next-phase: "none — cycle complete. Return to Phase 1 for next feature."
---

# Phase 4 — Deploy

## Purpose
Ship safely to production, verify every layer is green, and close the loop with a journal entry. Delegate to CTO (tech) + COO (ops) via orchestrator.

## Agent Instructions

You are acting as **CTO + COO** in deploy mode. Read the deployment checklist template and fill it before starting.

### Step 1 — Pre-Deploy Checklist

Open `.sophia-factory/templates/deployment-checklist.md`, fill it, save as `plans/{slug}/deployment-checklist.md`.

Must confirm ALL of:
- [ ] PR merged to `main` (not just approved)
- [ ] All CI checks green (GitHub Actions)
- [ ] `npm run typecheck` — 0 errors
- [ ] `npm test` — all pass
- [ ] `npm run build` — exit code 0
- [ ] No new `: any` introduced (`grep -r ": any" src | wc -l = 0`)
- [ ] Protected flows untouched (Setup Wizard / Telegram / NOWPayments)
- [ ] New env vars added to CF dashboard (NOT committed to repo)

### Step 2 — Deploy

```bash
# CF Pages auto-deploys on push to main via GitHub Actions
git push origin main

# Verify CI triggered
gh run list -L 1 --json status,conclusion
```

Wait for GitHub Actions to complete (max 5 min). Poll:
```bash
MAX=10; I=0
while [ $I -lt $MAX ]; do
  I=$((I+1))
  STATUS=$(gh run list -L 1 --json status,conclusion -q '.[0]')
  echo "Attempt $I: $STATUS"
  echo "$STATUS" | grep -q '"conclusion":"success"' && break
  echo "$STATUS" | grep -q '"conclusion":"failure"' && echo "CI FAILED — stop" && break
  sleep 30
done
```

### Step 3 — Production Smoke Test

```bash
PROD="https://sophia.agencyos.network"
HTTP=$(curl -sI "$PROD" | head -1 | awk '{print $2}')
echo "Production: $HTTP"

# Health check
curl -s "$PROD/api/health" | jq '.status'

# Version check (confirms new commit deployed)
curl -s "$PROD/api/version" | jq '.commit'
```

Expected: HTTP 200, health status `ok`, version matches merged commit SHA.

### Step 4 — Feature Smoke Test

Test the specific feature just deployed:
- [ ] Happy path works end-to-end
- [ ] Error states handled gracefully
- [ ] Bilingual labels display correctly
- [ ] Tier gate enforced (wrong tier returns 403)
- [ ] No console errors in browser (if UI change)

### Step 5 — Canary Monitoring (if P1 canary active)

If canary split is active:
```bash
# Check error rate differential between versions
curl -s "$PROD/api/metrics" \
  -H "Authorization: Bearer $INTROSPECT_TOKEN" | jq '.canary'
```

If canary error rate > 2x stable → recommend rollback to founder. Founder executes: `wrangler rollback`.

### Step 6 — Post-Deploy Ops Update (COO)

COO agent tasks after successful deploy:
- Update `docs/operations/weekly-ops-report.md` with deploy timestamp.
- If cron schedule changed → update cron descriptions in `src/app/api/cron/`.
- If new env var added → document in `docs/operations/env-vars.md`.
- Notify via Telegram bot if major feature: draft message for founder to send.

### Step 7 — Journal

Write `.sophia-factory/journal/YYYYMMDD-deploy-{slug}.md`:
```
## Action: Production deploy of "{feature}"
## Decision: {any rollback considerations / canary config}
## Outcome:
- Build: ✅ exit 0
- Tests: ✅ N passed
- Git Push: ✅ {commit_sha} → main
- CI/CD: ✅ GitHub Actions success
- Production: ✅ HTTP 200
- Feature smoke: ✅ all checks passed
- Timestamp: {actual_time}
## Lessons: {any deploy pattern or incident to remember}
```

**PII SCRUB before write**: strip commit SHA if it leaks user data, strip any customer-specific test data.

### Step 8 — Cycle Closed

Report to founder:
```
✅ {Feature name} is live on https://sophia.agencyos.network
Commit: {sha}
Tests: {N} passed
Deploy time: {duration}
Next: [link to next planned feature or return to backlog]
```

## Anti-Patterns to Avoid
- Do NOT report "done" before production HTTP 200 confirmed.
- Do NOT merge directly to main — always via PR + CI gate.
- Do NOT use `git push --force` — escalate merge conflicts to founder.
- Do NOT commit env vars — CF dashboard only.
- Do NOT skip the feature smoke test — CI passing ≠ feature working.
