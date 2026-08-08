# Phase 06: CF-Direct Deploy & Verify

**Priority:** CRITICAL
**Status:** Pending
**Dependencies:** Phase 05

---

## Context Links
- Deploy script: `scripts/deploy-with-sha.sh`
- Verification: `scripts/sophia-doctor.mjs`
- Production URL: `https://sophia.agencyos.network`
- Version endpoint: `https://sophia.agencyos.network/api/version`
- Deploy verification rules: `.claude/rules/sophia-deploy-verify.md`

---

## Overview
Execute CF-direct deployment and verify using SHA match (not just HTTP 200).

---

## Implementation Steps
1. **Step 0:** `git push origin main` — deploy script rejects unpushed commits
2. **Step 1:** `npm run deploy:full` — builds and deploys via wrangler
3. **Step 2:** Apply migrations if any changed: `bash scripts/apply-migrations.sh`
4. **Step 3:** Verify SHA match:
   ```bash
   LOCAL_SHA=$(git rev-parse HEAD | cut -c1-8)
   LIVE_SHA=$(curl -s https://sophia.agencyos.network/api/version | grep -o '"shortSha":"[^"]*"' | cut -d'"' -f4)
   [ "$LOCAL_SHA" = "$LIVE_SHA" ] && echo "✅ MATCH" || echo "❌ MISMATCH"
   ```
5. **Step 4:** HTTP health check: `curl -sI https://sophia.agencyos.network | head -3`
6. **Step 5:** Run `npm run deploy:verify` — sophia-doctor health checks

---

## Todo List
- [ ] `git push origin main`
- [ ] `npm run deploy:full` → exit 0
- [ ] Check for new migrations → apply if needed
- [ ] Verify SHA match (local == live)
- [ ] HTTP 200 on production URL
- [ ] `npm run deploy:verify` → all checks pass

---

## Success Criteria (MANDATORY per sophia-deploy-verify.md)
- ✅ Build: exit code 0
- ✅ Tests: all pass
- ✅ Deploy: `npm run deploy:full` → wrangler deployed
- ✅ Migrations: none new OR applied via apply-migrations.sh
- ✅ Production HTTP: 200
- ✅ Deploy SHA Match: `/api/version` shortSha == local shortSha
- ✅ Deploy verified timestamp recorded

---

## Risk Assessment
| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Wrangler deploy fails | Medium | Critical | Check wrangler.toml bindings, secrets |
| SHA mismatch (stale deploy) | Medium | Critical | Re-run deploy:full, check wrangler version |
| Migration failure | Low | High | Test apply-migrations.sh locally first |
| D1 binding mismatch | Low | Critical | Verify wrangler.toml DB binding name |

---

## Anti-Patterns to Avoid (per sophia-deploy-verify.md)
- ❌ Polling `gh run list` — GitHub Actions disabled
- ❌ Curl HTTP 200 without SHA check
- ❌ Reporting "Done" before SHA match passes
- ❌ "CI/CD GREEN" — no CI, use "Deploy: ✅ CF-direct"

---

## Next Steps
→ **SHIP COMPLETE** — Report verification results