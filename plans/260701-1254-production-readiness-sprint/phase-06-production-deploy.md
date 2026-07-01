# Phase 06 — Production Deploy + Final Verification

**Priority:** P0 | **Effort:** 0.5h | **Status:** pending | **Depends on:** Phase 03, Phase 05

## Overview

Deploy both tracks to production, verify end-to-end, and close out E3/E4 roadmap items.

## Prerequisites

- [ ] Phase 03 complete: OTEL verified in staging
- [ ] Phase 05 complete: BYOK rotation verified in staging
- [ ] All tests pass (`npm test`)
- [ ] Build passes (`npm run build`)
- [ ] Lint clean (`npm run lint`)

## Implementation Steps

### 1. Final pre-deploy checks (~5 min)

```bash
cd apps/sophia-ai-factory
npm run type-check    # 0 errors
npm run lint          # clean
npm test              # all pass (6694+ tests)
```

### 2. Deploy to production (~10 min)

```bash
git push origin main
npm run deploy:full
```

### 3. Verify SHA match (~5 min)

```bash
LOCAL_SHA=$(git rev-parse HEAD | cut -c1-8)
LIVE_SHA=$(curl -s https://sophia.agencyos.network/api/version | grep -o '"shortSha":"[^"]*"' | cut -d'"' -f4)
echo "Local: $LOCAL_SHA  Live: $LIVE_SHA"
[ "$LOCAL_SHA" = "$LIVE_SHA" ] && echo "✅ DEPLOY MATCHES COMMIT" || echo "❌ STALE"
```

### 4. Verify OTEL in production (~5 min)

- Open Honeycomb UI → production dataset
- Confirm spans flowing (1% samplerate → expect fewer spans than staging)
- Check `wrangler tail` for `[OTel] Initialized` log
- Verify no crash errors

### 5. Verify BYOK rotation in production (~5 min)

- Check key_versions table has expected versions
- Confirm no stuck re-encryption jobs
- Verify audit log integrity

### 6. Update roadmap + changelog

Update `docs/development-roadmap.md`:
- E3 OTEL: status → `✅ COMPLETE`
- E4 BYOK Rotation: status → `✅ COMPLETE`

Update `docs/project-changelog.md`:
```markdown
- **2026-07-01** — Production Readiness Complete: OTEL instrumentation activated (Honeycomb traces flowing at 1%), BYOK key rotation verified end-to-end in production. Q2 enterprise hardening 100% complete.
```

## Success Criteria

- [ ] `npm run deploy:full` exits 0
- [ ] SHA verified on `/api/version`
- [ ] HTTP 200 on production URL
- [ ] OTEL spans visible in Honeycomb production dataset
- [ ] BYOK rotation pipeline healthy (no stuck jobs)
- [ ] Roadmap updated: E3 + E4 = ✅ COMPLETE
- [ ] Changelog updated
- [ ] Q2 enterprise hardening: 6/6 complete

## Post-Completion

After this phase, resume 3 pending plans:
1. **P0:** Security Audit Fixes (remaining phases after partial completion)
2. **P1:** A/B Runner + Credit Bar (not started)
3. **P2:** Programmatic Landing Pages (core code shipped, admin test phase remaining)
