# Brainstorm Report: Client-Ready UX — Quick Fixes

**Date:** 2026-07-02 18:49 | **Project:** Sophia AI Factory | **Status:** ✅ Design Approved

---

## Problem

User journey audit showed 3 UX gaps on the landing-to-login flow. Fixes are small and well-defined.

## Scope

| # | Gap | Fix | Effort |
|---|-----|-----|--------|
| 1 | Hero "Start Free" → `/signup` (redundant redirect) | Change to direct `/login?tab=signup` | ~10 min |
| 2 | `/redeem` route — CTA button tồn tại nhưng route? | Verify route exists, fix nếu missing | ~15 min |
| 3 | Affiliate Discovery section 500 error | Verify section, add error boundary | ~30 min |

## Files

- Modify: `src/app/components/sections/hero.tsx` (CTA href)
- Verify: `src/app/[locale]/redeem/` (exists?)
- Verify: `src/app/components/sections/affiliate-discovery.tsx` (error handling)

## Out of Scope

- Login page redesign
- Dashboard first-session overhaul
- Forgot password flow

## Next Steps

1. Create `/ck:plan` then implement
