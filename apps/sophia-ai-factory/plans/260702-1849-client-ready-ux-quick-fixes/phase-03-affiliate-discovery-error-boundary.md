---
phase: 3
title: "Affiliate Discovery Error Boundary"
status: pending
effort: "~30 min"
priority: P2
---

# Phase 3: Affiliate Discovery Error Boundary

## Overview

Affiliate Discovery section on landing page previously returned 500 error (spinner forever). Add error boundary and verify the section renders correctly.

## Requirements

- Add React error boundary around AffiliateDiscovery section on landing page
- Verify the section loads without 500 errors
- Graceful fallback UI if section fails (not blank spinner)

## Related Code Files

- Modify: `src/app/[locale]/page.tsx` (wrap AffiliateDiscovery in ErrorBoundary)
- Read: `src/app/components/sections/affiliate-discovery.tsx` (understand error source)

## Implementation Steps

1. Check if ErrorBoundary component exists in the project (`src/seed/components/error-boundary.tsx`)
2. If exists: wrap `AffiliateDiscovery` dynamic import
3. If not: create simple ErrorBoundary client component
4. Test the section renders without errors

## Success Criteria

- [ ] AffiliateDiscovery wrapped in error boundary
- [ ] Fallback UI shown on error (not infinite spinner)
- [ ] Section renders correctly when no error
- [ ] Build passes
