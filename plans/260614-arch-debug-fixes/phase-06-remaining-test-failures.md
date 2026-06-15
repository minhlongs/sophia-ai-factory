# Phase 06: Fix Remaining Test Failures

**Priority:** P2 (Buffer)  
**Status:** Not Started  
**Estimated Duration:** 3 hours

---

## Context Links

- **Phase 00 test results:** 104 test failures across 28 files
- **Known issues:**
  - `shouldSkipPolling is not defined` (publish-execute-telegram-c1.test.ts)
  - `campaign.video_url` null access (CampaignDetailPage)
  - `better-sqlite3` binary mismatch
  - `createFakeD1` tests (out of scope for D1 migration but need to pass)
  - Various mock/stubbing issues

---

## Overview

After D1 binding fixes and mock pattern fixes, some test failures remain due to code bugs (not test infrastructure). These need to be addressed to reach 100% test pass.

**Failure categories:**
1. **Missing imports in tests** — `shouldSkipPolling` undefined
2. **Component null handling** — `campaign.video_url` assumes non-null
3. **SQLite binary compatibility** — Node 24 vs compiled binary
4. **createFakeD1 tests** — may need SQLite rebuild
5. **Other logic mismatches** — test expectations vs actual behavior

---

## Requirements

### Functional
1. Fix `shouldSkipPolling` undefined — add import from source
2. Fix `CampaignDetailPage` null `campaign.video_url` — add guard or default fixture
3. Rebuild `better-sqlite3` for Node 24 compatibility
4. Ensure `createFakeD1` tests work with rebuilt SQLite
5. Address any other failing tests (review after above fixed)

### Non-Functional
1. No changes to business logic unless bug confirmed
2. Component fixes should not break existing UI
3. Keep test fixtures realistic
4. All fixes must be type-safe

---

## Implementation Steps

### Step 1: Fix shouldSkipPolling import

File: `src/forest/inngest/functions/__tests__/publish-execute-telegram-c1.test.ts`

Error: `ReferenceError: shouldSkipPolling is not defined`

Find where `shouldSkipPolling` is defined (likely in same directory as function under test):
```bash
grep -rn "function shouldSkipPolling\\|const shouldSkipPolling" src/forest/inngest/functions/
```

Add import at top of test file:
```typescript
import { shouldSkipPolling } from './publish-execute'; // adjust path
```

Or define locally if it's a helper function used only in tests.

### Step 2: Fix campaign.video_url null access

File: `src/app/[locale]/dashboard/campaigns/[id]/page.test.tsx` + `page.tsx`

Test expects `campaign` to have `video_url` but fixture returns null.

**Option A — Fix test fixture:** Ensure mock returns campaign with `video_url` populated:
```typescript
const mockCampaign = {
  id: '123',
  video_url: 'https://example.com/video.mp4',
  thumbnail_url: 'https://example.com/thumb.jpg',
  status: 'active',
  // ...
};
```

**Option B — Fix component guard:** In `page.tsx`, add null check:
```typescript
<VideoPreview
  videoUrl={campaign?.video_url ?? null}
  thumbnailUrl={campaign?.thumbnail_url ?? null}
  status={campaign?.status ?? 'draft'}
/>
```

Prefer Option B for robustness (component should handle missing data).

### Step 3: Rebuild better-sqlite3

Node 24 binary incompatible with previously installed binary.

```bash
pnpm rebuild better-sqlite3
```

Or clean reinstall:
```bash
rm -rf node_modules/better-sqlite3
pnpm install
```

Verify rebuild:
```bash
node -e "require('better-sqlite3')"  # should not throw
```

### Step 4: Verify createFakeD1 tests

After SQLite rebuild, run:
```bash
npm test -- src/forest/publishing/__tests__/fake-d1-sqlite.test.ts src/land/tenant-settings/__tests__/export-import-roundtrip.test.ts
```

If still failing, check `createFakeD1` implementation uses `new Database(':memory:')` — should work with rebuilt binary.

### Step 5: Re-run full test suite

```bash
npm test 2>&1 | tail -50
```

Capture new failure count. Iterate until 0 failures or only known out-of-scope items remain.

---

## Related Code Files

- `src/forest/inngest/functions/__tests__/publish-execute-telegram-c1.test.ts`
- `src/app/[locale]/dashboard/campaigns/[id]/page.test.tsx`
- `src/app/[locale]/dashboard/campaigns/[id]/page.tsx`
- `node_modules/better-sqlite3/` (binary)
- `src/forest/publishing/__tests__/fake-d1-sqlite.ts`
- `src/land/tenant-settings/__tests__/export-import-roundtrip.test.ts`

---

## Success Criteria

- All `shouldSkipPolling` errors resolved
- `CampaignDetailPage` handles null `campaign` gracefully
- `better-sqlite3` loads without binary error
- `createFakeD1` tests pass
- Test failures reduced from 104 to ≤10 (buffer acceptable threshold)

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| SQLite rebuild fails | Low | Medium | Use prebuilt binaries; `pnpm add better-sqlite3@latest` |
| Component guard breaks existing UI | Low | Medium | Verify component still renders with null video_url (show placeholder) |
| Test expectations wrong (not bug) | Medium | Low | Confirm expected behavior before changing code |
| Some failures genuinely out of scope | High | Low | Document and accept for Phase 06 completion |

---

## Commands Reference

```bash
# Rebuild SQLite
pnpm rebuild better-sqlite3

# Test specific files
npm test -- src/forest/inngest/functions/__tests__/publish-execute-telegram-c1.test.ts
npm test -- src/app/[locale]/dashboard/campaigns/[id]/page.test.tsx

# Full test run
npm test 2>&1 | tee /tmp/test-run.log
grep -E "FAIL|passed|failed" /tmp/test-run.log | tail -20
```

---

**END OF PHASE 06**
