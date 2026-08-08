# Bootstrap & Ship Plan — Sophia AI Factory

**Created:** 2026-08-09 10:00
**Target:** Production-ready deploy to Cloudflare Workers via CF-direct doctrine
**Context:** Fix type errors, test failures, and verify all protected flows

---

## Current State Summary

| Check | Status | Details |
|-------|--------|---------|
| TypeScript | ❌ FAIL | 30+ errors in `src/tree/audit/`, `src/forest/missions/` |
| Build | ✅ PASS | Build completes with warnings (source map upload) |
| Tests | ❌ FAIL | 1 test file broken (import resolution), 6557 pass |
| Lint | Unknown | Not yet run |
| i18n | ✅ PASS | 2766 keys validated, 0 missing |

---

## Phase Overview

| Phase | Title | Priority | Status | Dependencies |
|-------|-------|----------|--------|--------------|
| 01 | Fix TypeScript Errors | CRITICAL | Pending | — |
| 02 | Fix Broken Test Import | CRITICAL | Pending | 01 |
| 03 | Run Full Test Suite + Lint | HIGH | Pending | 02 |
| 04 | Validate Protected Flows | CRITICAL | Pending | 03 |
| 05 | Verify Build & Deploy Readiness | HIGH | Pending | 04 |
| 06 | CF-Direct Deploy & Verify | CRITICAL | Pending | 05 |

---

## Key Risks

1. **Audit module type debt** — Multiple `unknown` type issues in GDPR, right-to-erasure, crypto-utils
2. **Test import resolution** — `../api-key-auth` missing or misnamed
3. **Deploy verification** — Must pass SHA match, not just HTTP 200
4. **Protected flows** — Setup Wizard, Telegram Bot, Payment Flow must work end-to-end

---

## Success Criteria

- [ ] `npm run type-check` → 0 errors
- [ ] `npm test` → all 6600+ tests pass
- [ ] `npm run lint` → 0 errors (warnings OK per CI config)
- [ ] `npm run build` → 0 TypeScript errors
- [ ] Protected flows validated manually or via E2E
- [ ] `npm run deploy:full` → exit 0
- [ ] `/api/version` shortSha matches local commit
- [ ] Production URL returns HTTP 200

---

## Next Actions

Start with Phase 01: Fix TypeScript Errors in audit and missions modules.