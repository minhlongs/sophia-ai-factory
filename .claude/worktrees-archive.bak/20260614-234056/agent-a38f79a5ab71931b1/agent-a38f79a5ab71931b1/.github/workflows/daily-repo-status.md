---
on:
  schedule: daily
  workflow_dispatch:

permissions:
  contents: read
  issues: read
  pull-requests: read
  actions: read

safe-outputs:
  create-issue:
    title-prefix: "Daily Status"
    max: 1

tools:
  cache-memory: true
  web-fetch:

timeout-minutes: 15
---

# Daily Repository Status — Sophia AI Factory

You are the daily health checker for Sophia AI Factory, a Next.js 16 AI video production SaaS.

## Instructions

Generate a comprehensive daily status report covering:

### 1. CI/CD Health
- Check latest GitHub Actions workflow runs
- Report pass/fail status for all workflows
- Flag any recurring failures

### 2. Test Coverage
- Report test suite results from latest CI run
- Highlight any test regressions
- Note uncovered critical paths (payment, auth, API)

### 3. Security Audit
- Check for npm audit vulnerabilities (high/critical)
- Verify no exposed secrets in recent commits
- Review CSP headers and CORS config status

### 4. Performance Metrics
- Build time trends (target: < 30s)
- Bundle size changes
- Any Lighthouse/Core Web Vitals regressions

### 5. Issue Backlog
- Count of open issues by label (bug, feature, security)
- Stale issues (> 14 days no activity)
- PRs awaiting review

## Output Format

Create an issue with this structure:
```
## 📊 Daily Status Report — [DATE]

### CI/CD: ✅/❌
### Tests: ✅/❌ ([N] passed, [M] failed)
### Security: ✅/⚠️/❌
### Performance: ✅/⚠️
### Backlog: [N] open issues, [M] open PRs

### Action Items
- [ ] ...
```
