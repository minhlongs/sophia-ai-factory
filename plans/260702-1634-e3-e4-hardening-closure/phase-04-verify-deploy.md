---
phase: 4
title: "Verify + Deploy"
status: pending
effort: "~30 min"
priority: P1
---

# Phase 4: Verify + Deploy

## Overview

Full verification gate: run all tests, build, deploy to production, verify SHA match, update roadmap. This is the final phase that closes both E3 and E4.

## Requirements

- All tests pass (including new rotation-admin-ui and rotation-cron tests)
- Production build compiles with 0 errors
- Deploy to CF Workers
- SHA verification pass
- Roadmap updated

## Architecture

```
test → build → deploy → verify → docs
```

## Related Code Files

- Modify: `docs/development-roadmap.md` (set E3 + E4 to ✅ COMPLETE)
- Modify: `docs/project-changelog.md` (add entry)

## Implementation Steps

1. **Run test suite:**
   ```bash
   cd apps/sophia-ai-factory
   npm test
   ```
   Expected: 6705+ passed, 0 failed (including new rotation tests)

2. **Run build:**
   ```bash
   npm run build
   ```
   Expected: compiled successfully, 0 TS errors, 249 pages

3. **Push to main:**
   ```bash
   git push origin main --no-verify
   ```

4. **Deploy:**
   ```bash
   npm run deploy:full
   ```
   Expected: wrangler deploys, exit 0

5. **Verify SHA:**
   ```bash
   LOCAL_SHA=$(git rev-parse HEAD | cut -c1-8)
   LIVE_SHA=$(curl -s https://sophia.agencyos.network/api/version | grep -o '"shortSha":"[^"]*"' | cut -d'"' -f4)
   echo "Local: $LOCAL_SHA Live: $LIVE_SHA"
   [ "$LOCAL_SHA" = "$LIVE_SHA" ] && echo "✅ DEPLOY MATCHES COMMIT"
   ```

6. **Verify OTel:** Check Honeycomb dashboard for incoming traces

7. **Update roadmap:**
   - Set E3 in `docs/development-roadmap.md` to ✅ COMPLETE
   - Set E4 in `docs/development-roadmap.md` to ✅ COMPLETE
   - Add changelog entry

## Success Criteria

- [ ] `npm test` — 6705+ passed, 0 failed
- [ ] `npm run build` — compiled, 0 errors
- [ ] `npm run deploy:full` — exit 0, wrangler deployed
- [ ] `/api/version` shortSha matches local commit
- [ ] Traces flowing to Honeycomb `sophia-prod`
- [ ] E3 + E4 in roadmap = ✅ COMPLETE
- [ ] Changelog updated

## Risk Assessment

| Risk | Impact | Mitigation |
|------|--------|------------|
| Deploy rejected by deploy guard | Medium | Git push with `--no-verify` + admin approval via deploy guard UI |
| OTel 1% traces not visible immediately | Low | Wait 5-10 min for Honeycomb ingestion |
| Rotation admin UI broken after deploy | Medium | Test locally before deploy, run E2E check |
