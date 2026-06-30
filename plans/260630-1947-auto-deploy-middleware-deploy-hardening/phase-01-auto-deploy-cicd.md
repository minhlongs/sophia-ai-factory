# Phase 01: Auto-Deploy CI/CD

**Priority:** P2 | **Effort:** 2-3h | **Status:** completed

## Context Links
- Parent: [plan.md](plan.md)
- Brainstorm: [brainstorm-260629-1957-zero-bug-systemic-quality.md](../../reports/brainstorm-260629-1957-zero-bug-systemic-quality.md)
- Deploy doctrine: `.claude/rules/sophia-deploy-verify.md`
- Disabled workflow: `.github/workflows/test.yml.disabled` (in git history)

## Overview

Re-enable GitHub Actions auto-deploy: push main → build → wrangler deploy → SHA verify. Currently deploy is manual `npm run deploy:full` from local machine.

## Requirements

### Functional
- Push to `main` triggers deploy job automatically
- Deploy job runs `npm run deploy:full` (build + wrangler deploy)
- Post-deploy SHA verification: deployed SHA must match commit SHA
- Failed deploy → GitHub Actions notification (email + workflow status)
- PRs run quality gate only (typecheck + lint + test), no deploy

### Non-Functional
- Deploy must complete within GitHub Actions timeout (15 min default)
- Secrets: CLOUDFLARE_API_TOKEN, CLOUDFLARE_ACCOUNT_ID stored as GitHub Secrets
- SKIP_SYMBOL_UPLOAD=1 by default (per no-tech doctrine)
- Must NOT break existing manual deploy flow (`deploy-with-sha.sh`)

## Architecture

```
Push main → GitHub Actions
  ├── Job 1: quality (typecheck + lint + test)
  └── Job 2: deploy (needs: quality, main only)
       ├── Checkout (fetch-depth: 0)
       ├── Setup Node 20
       ├── Install deps
       ├── Build + Deploy (npm run deploy:full)
       ├── Verify SHA match
       └── Notify on failure
```

## Related Code Files

| Action | File |
|--------|------|
| Create | `.github/workflows/deploy.yml` |
| Modify | `package.json` (add deploy:ci script if needed) |
| Read | `scripts/deploy-with-sha.sh` |
| Read | `wrangler.toml` |

## Implementation Steps

1. Restore disabled workflow from git history: `git show HEAD:.github/workflows/test.yml.disabled`
2. Update workflow for 2026 reality: `npm run deploy:full` instead of `npm run deploy:build` + separate deploy
3. Add SHA verification step (curl + grep from sophia-deploy-verify.md)
4. Add `SKIP_SYMBOL_UPLOAD=1` as default env
5. Create `.github/workflows/deploy.yml`
6. Verify workflow syntax: `act --dryrun` or GitHub Actions UI validation
7. Set up GitHub Secrets (user action): CLOUDFLARE_API_TOKEN, CLOUDFLARE_ACCOUNT_ID
8. Test: push to branch → confirm quality gate passes → merge to main → confirm auto-deploy

## Todo List
- [x] Restore + update disabled workflow
- [x] Add SHA verification step
- [x] Create `.github/workflows/deploy.yml`
- [x] Verify workflow YAML syntax
- [x] Document secrets setup for user
- [ ] Test deploy flow end-to-end

## Success Criteria
- [ ] `git push origin main` triggers deploy job
- [ ] Deploy completes with SHA match verification
- [ ] Failed build does NOT deploy
- [ ] PR builds run quality gate only
- [ ] Manual `npm run deploy:full` still works

## Risk Assessment
| Risk | Likelihood | Mitigation |
|------|-----------|------------|
| CF_API_TOKEN expired/invalid | Medium | Document token creation; test before merge |
| Worker size limit (10 MiB) | Low | Already handled by deploy script |
| GitHub Actions free tier limits | Low | Current repo has minimal Actions usage (disabled) |
| Deploy script timeout | Low | SKIP_SYMBOL_UPLOAD=1 saves 30+ min |

## Next Steps
- After Phase 01 complete → user sets GitHub Secrets → merge to main → verify auto-deploy
