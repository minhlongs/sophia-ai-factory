---
phase: 3
title: "Page Render Check"
status: complete
effort: "Built into pre-deploy-gate.mjs Step 2"
---

# Phase 3: Page Render Check

## Overview

Validates that critical application pages return HTTP 200 (not 404/500) before deployment. Runs against a local dev server or preview URL.

## Implementation

**File:** `apps/sophia-ai-factory/scripts/pre-deploy-gate.mjs`
**Function:** `checkPageRender()`

### URLs Checked

| URL | Expected | Reason |
|-----|----------|--------|
| `/` | 200 | Homepage |
| `/login` | 200 | Login page |
| `/auth/signup` | 200 | Signup page |
| `/pricing` | 200 | Pricing page |
| `/reset-password` | 200 | Password reset page |
| `/api/health` | 200 | Health endpoint |
| `/api/version` | 200 | Version endpoint |
| `/en/login` | 200 or 307 | English locale |
| `/vi/login` | 200 or 307 | Vietnamese locale |
| `/guide` | 200 | Guide page |
| `/privacy` | 200 | Privacy policy |
| `/terms` | 200 | Terms of service |

### Algorithm

1. **Determine base URL** — Uses `PREVIEW_URL` env var if set, otherwise `http://localhost:3000`
2. **Fetch each URL** — `fetch()` with 10s timeout per URL
3. **Classify response**:
   - 200 → pass
   - 307, 308 → pass (locale redirect is expected)
   - 404, 500, other → FAIL
4. **Report** — List all failed URLs with status codes; exit 1 if any failures

### Environment

- Default: expects `npm run dev` running on localhost:3000
- Preview: set `PREVIEW_URL=https://preview.deploy.workers.dev` to test a deployed preview
- CI: runs automatically after build in `deploy-with-sha.sh` if dev server is reachable

## Success Criteria

- [x] All 12 critical URLs return 200 or 307/308
- [x] Failed URLs are reported with exact status code
- [x] Gate exits 1 on any failure, blocking deploy
- [x] Bypass: `SKIP_PRE_DEPLOY_GATE=1` skips entire gate (emergency only)
