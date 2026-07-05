---
phase: 5
title: "Pre-Launch QA"
status: completed
effort: "Small (1-2h)"
priority: P2
dependencies: [1, 2, 3, 4]
---

# Phase 5: Pre-Launch QA

## Overview

Final QA before launching the Creator Marketplace. Verify all flows end-to-end, fix issues, prepare launch.

## Implementation Steps

### 5.1 End-to-end flow verification

Walk through every user flow:
1. **Visitor:** Browse public marketplace → see SOPs → filter by category → search
2. **Creator (non-MASTER):** Access creator dashboard → see "Become a Creator" → submit application
3. **Creator (approved):** Access dashboard → see earnings → create new SOP → submit for review
4. **Admin review:** Approve/reject pending SOP → published appears in marketplace
5. **Creator (MASTER):** Unrestricted access (existing flow unchanged)
6. **Install:** Click SOP → install flow works
7. **Payout:** View wallet → set payout method → see payout history

### 5.2 Bilingual verification

- All new pages render correctly in Vietnamese and English
- No missing i18n keys (run `npm test` which includes i18n validation)
- No hardcoded English strings in components

### 5.3 Build verification

```bash
npm run build   # 0 TypeScript errors
npm test        # all tests pass
```

### 5.4 Edge case testing

- Empty marketplace (no SOPs published) → show empty state
- Creator with zero earnings → show "No earnings yet" state
- Creator with pending review → show "Under review" message
- Invalid wallet address → show validation error
- User without beta invite → see "Become a Creator" CTA
- Mobile responsiveness of marketplace grid

### 5.5 Launch preparation

- Verify all links correct (no broken internal links)
- Verify DB migration applied cleanly
- Verify middleware doesn't block new `[locale]/sop-marketplace` route
- Add marketplace link to main navigation
- Verify wallet tier gate works for beta creators

## Success Criteria

- [ ] All 7 user flows verified end-to-end
- [ ] Bilingual check: all new pages work in VI + EN
- [ ] `npm run build` passes with 0 errors
- [ ] `npm test` passes all tests
- [ ] All edge cases handled (empty states, validation errors)
- [ ] No broken links in marketplace flow
- [ ] All migrations applied successfully

## Risk Assessment

- **Low:** QA phase with clear checklist. Issues fixable before launch.
- **Low:** Most infrastructure already exists and is tested.
