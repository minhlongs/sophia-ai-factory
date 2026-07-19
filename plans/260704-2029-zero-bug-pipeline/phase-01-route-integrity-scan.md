---
phase: 1
title: "Route Integrity Scan"
status: complete
effort: "Built into pre-deploy-gate.mjs Step 1"
---

# Phase 1: Route Integrity Scan

## Overview

Verifies that every internal `href="..."` link in React components has a corresponding Next.js App Router page. Prevents broken navigation caused by deleted pages or dangling references.

## Implementation

**File:** `apps/sophia-ai-factory/scripts/pre-deploy-gate.mjs`
**Function:** `checkRouteIntegrity()`

### Algorithm

1. **Extract href links** — `grep` for `href="/(?!https?:)"` (internal hrefs only, excluding absolute URLs and hash-only links)
   - Scope: `src/components/stitch/` and `src/app/[locale]/`
2. **Whitelist known non-page patterns** — Stitch stubs, modal anchors, anchor links (`#section`), external `https://` URLs
3. **Verify page exists** — For each cleaned href path:
   - Check `src/app/[locale]/<path>/page.tsx` exists (if `<path>` is not empty)
   - Check `src/app/(auth)/<path>/page.tsx` exists for /login, /signup, /reset-password
   - Check `src/app/guide/page.tsx`, `src/app/privacy/page.tsx`, `src/app/terms/page.tsx`
4. **Report undefined routes** — List any href paths without a matching page.tsx; exit 1 if any found

### Allowed Stitch Patterns (whitelisted)

```
src/app/[locale]/dashboard/stores/page.tsx → Stitch components
src/app/[locale]/dashboard/campaigns/page.tsx → Stitch components
src/app/[locale]/dashboard/billing/page.tsx → Stitch components
src/app/[locale]/dashboard/settings/page.tsx → Stitch components
```

### Key Insight

This check runs on the full `src/` tree, not just changed files, because a new component can reference any route regardless of what changed in the current commit.

## Success Criteria

- [x] `node scripts/pre-deploy-gate.mjs` Step 1 passes with 0 undefined routes
- [x] New broken href→page links are caught before deploy
- [x] Whitelist allows Stitch-generated pages without false positives
- [x] Bypass: `SKIP_PRE_DEPLOY_GATE=1` skips entire gate (emergency only)
