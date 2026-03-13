# E2E Test Scope Clarification - Sophia Proposal

**Date:** 2026-03-10 12:18 PM
**Task:** Add E2E tests for proposal creation flow
**Finding:** ⚠️ FEATURE NOT FOUND

---

## Current State

**Sophia Proposal** là một **Static Landing Page** - KHÔNG PHẢI proposal generation app.

### Existing Features ✅

| Feature | Status |
|---------|--------|
| Landing page | ✅ 10 sections |
| ROI Calculator | ✅ Interactive |
| Pricing display | ✅ 3 tiers |
| Affiliate programs | ✅ 18 programs |
| Animations | ✅ Framer Motion |

### Missing Features ❌

| Requested Feature | Status |
|-------------------|--------|
| Proposal creation | ❌ Not exists |
| Proposal editing | ❌ Not exists |
| Proposal preview | ❌ Not exists |
| PDF export | ❌ Not exists |
| User authentication | ❌ Not exists |
| Database | ❌ Not exists |

---

## Options

### Option 1: Build Proposal Generation Feature (NEW)

Add full proposal creation system:
- Form for inputting client info
- Template selection
- Live preview
- PDF export (via `react-pdf` or `jspdf`)
- Save to database (Supabase/PostgreSQL)

**Estimated effort:** 20-40 hours

### Option 2: Add E2E Tests for Existing Flow

Test current landing page:
- Page loads correctly
- Navigation works
- ROI calculator calculates
- All sections render
- Mobile responsive
- No console errors

**Estimated effort:** 2-4 hours

### Option 3: Add Playwright E2E Infrastructure

Setup E2E testing framework:
- Install Playwright
- Configure test runner
- Write basic smoke tests
- CI/CD integration

**Estimated effort:** 4-6 hours

---

## Recommendation

**Clarify requirement:** User requested "proposal creation flow" but this is a landing page.

**Suggested action:** Ask user which option they want:
1. Build new proposal generation feature
2. Test existing landing page
3. Setup E2E framework only

---

## Unresolved Questions

- Did user mean "test landing page" instead of "proposal creation"?
- Should we build proposal generation feature?
- What PDF export format is needed?
