# Phase 02: Fix Broken Test Import

**Priority:** CRITICAL
**Status:** Pending
**Dependencies:** Phase 01 (can run in parallel if import fix is independent)

---

## Context Links
- Test failure: `src/forest/missions/__tests__/api-key-auth.test.ts` line 20 — cannot resolve `../api-key-auth`

---

## Overview
Fix the missing import in the api-key-auth test file. The test imports `../api-key-auth` but this module doesn't exist at that path.

---

## Key Insights
- Likely the source file is named differently or in a different location
- Check `src/forest/missions/` for the actual module
- May need to update import path or create barrel export

---

## Related Code Files
### To Investigate
- `src/forest/missions/__tests__/api-key-auth.test.ts` — line 20
- `src/forest/missions/` — directory listing to find actual module

### To Modify
- `src/forest/missions/__tests__/api-key-auth.test.ts` — fix import path

---

## Implementation Steps
1. List `src/forest/missions/` to find the actual api-key-auth module
2. Determine correct import path
3. Update test file import
4. Run test to verify

---

## Todo List
- [ ] Find actual api-key-auth module location
- [ ] Fix import path in test file
- [ ] Run `npx vitest run src/forest/missions/__tests__/api-key-auth.test.ts`

---

## Success Criteria
- Test file imports without error
- All tests in suite pass

---

## Risk Assessment
| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Module deleted/renamed | Medium | High | Check git history if not found |
| Multiple test files affected | Low | Medium | Search for similar import patterns |

---

## Next Steps
→ Phase 03: Run Full Test Suite + Lint