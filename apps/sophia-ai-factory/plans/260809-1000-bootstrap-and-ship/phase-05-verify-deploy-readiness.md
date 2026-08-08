# Phase 05: Verify Build & Deploy Readiness

**Priority:** HIGH
**Status:** Pending
**Dependencies:** Phase 04

---

## Context Links
- Deploy script: `scripts/deploy-with-sha.sh`
- Pre-deploy gate: `scripts/pre-deploy-gate.mjs`
- Build command: `npm run build`

---

## Overview
Final verification before deployment. Ensure clean working tree, all gates pass, and deploy script ready.

---

## Implementation Steps
1. Run `npm run build` — confirm 0 TypeScript errors
2. Run `npm run ci` — full CI gate (typecheck, lint, test, secrets, audit)
3. Run `npm run pre-deploy:gate` — pre-deploy verification
4. Verify `git status` — working tree must be clean
5. Verify `wrangler.toml` has correct production bindings

---

## Todo List
- [ ] `npm run build` → success, 0 TS errors
- [ ] `npm run ci` → all gates pass
- [ ] `npm run pre-deploy:gate` → pass
- [ ] `git status` → clean working tree
- [ ] `wrangler.toml` verified for production

---

## Success Criteria
- All CI gates green
- Clean git status
- Deploy script executable

---

## Risk Assessment
| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Secrets in working tree | Low | Critical | `npm run ci:secrets` catches |
| Missing D1 migration | Medium | High | Check `git diff HEAD~1 -- migrations/` |

---

## Next Steps
→ Phase 06: CF-Direct Deploy & Verify