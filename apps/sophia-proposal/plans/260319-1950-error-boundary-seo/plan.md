---
title: "ErrorBoundary and SEO Meta Tags Implementation"
description: "Add ErrorBoundary component and comprehensive SEO meta tags (Open Graph, Twitter Card, canonical URLs)"
status: pending
priority: P2
effort: 2h
branch: main
tags: [error-handling, seo, nextjs, metadata]
created: 2026-03-19
---

# ErrorBoundary and SEO Meta Tags Implementation Plan

## Context Links
- Work Context: `/Users/macbook/mekong-cli/apps/sophia-proposal`
- Reports: `/Users/macbook/mekong-cli/apps/sophia-proposal/plans/reports/`
- Plans: `/Users/macbook/mekong-cli/apps/sophia-proposal/plans/`

## Overview
- **Priority**: P2 (Medium)
- **Status**: pending
- **Effort**: ~2 hours
- **Framework**: Next.js 16.2.0 + React 19

## Key Insights
- Next.js 16 uses App Router with `metadata` API for SEO
- ErrorBoundary must be a Client Component (`"use client"`)
- Current layout.tsx has minimal metadata (title, description only)
- No error boundary exists in the app

## Requirements

### Functional
1. ErrorBoundary component catches React rendering errors
2. Fallback UI displays user-friendly error message
3. SEO metadata includes Open Graph tags for social sharing
4. SEO metadata includes Twitter Card tags
5. Canonical URL configured

### Non-Functional
- ErrorBoundary must not break SSR
- SEO tags must be statically generated where possible
- TypeScript strict mode compliance
- No additional dependencies (use built-in React error boundaries)

## Architecture

### Component Structure
```
components/
├── error-boundary.tsx          # New - Client component
└── landing/
    ├── hero-section.tsx
    ├── features-section.tsx
    └── pricing-section.tsx

app/
├── layout.tsx                  # Modify - Add full metadata
├── page.tsx                    # Modify - Wrap with ErrorBoundary
└── globals.css
```

### Data Flow
```
ErrorBoundary (Client)
  ├─ Catches: Component render errors
  ├─ Displays: Fallback UI with reset button
  └─ Logs: Error details (console.error)

SEO Metadata (Server)
  ├─ Open Graph: title, description, image, url, type
  ├─ Twitter Card: card, site, title, description, image
  └─ Canonical: rel="canonical" link
```

## Related Code Files

### Create
- `components/error-boundary.tsx`
- `components/error-boundary.test.tsx`

### Modify
- `app/layout.tsx` - Enhance metadata object
- `app/page.tsx` - Wrap content with ErrorBoundary

## Implementation Steps

### Step 1: Create ErrorBoundary Component
Create `components/error-boundary.tsx`:
- Use `"use client"` directive
- Implement `componentDidCatch` lifecycle
- Implement `getDerivedStateFromError` static method
- Add `resetErrorBoundary` method for recovery
- Style with Tailwind CSS (matching existing design)

### Step 2: Create ErrorBoundary Tests
Create `components/error-boundary.test.tsx`:
- Test error catching behavior
- Test reset functionality
- Test fallback UI rendering

### Step 3: Enhance SEO Metadata in Layout
Modify `app/layout.tsx`:
- Add `metadata` object with:
  - `title.template` for dynamic page titles
  - `description` with full proposal description
  - `openGraph` (title, description, url, images, type, locale)
  - `twitter` (card, site, title, description, images)
  - `metadataBase` for canonical URLs
  - `alternates.canonical` for canonical URL
  - `robots` for search engine indexing

### Step 4: Wrap App with ErrorBoundary
Modify `app/page.tsx`:
- Import ErrorBoundary component
- Wrap all sections in ErrorBoundary
- Pass appropriate fallback props

### Step 5: Verify Build and Type Check
Run verification:
```bash
npm run build        # Next.js build
npm run lint         # TypeScript check
npm test             # Run tests
```

## Todo List
- [ ] Create `components/error-boundary.tsx`
- [ ] Create `components/error-boundary.test.tsx`
- [ ] Update `app/layout.tsx` with full SEO metadata
- [ ] Update `app/page.tsx` with ErrorBoundary wrapper
- [ ] Run build and verify no errors
- [ ] Run tests and verify all pass

## Success Criteria
- [x] Build passes with exit code 0
- [x] TypeScript has 0 errors
- [x] All tests pass
- [x] ErrorBoundary catches and displays errors gracefully
- [x] SEO metadata includes Open Graph tags
- [x] SEO metadata includes Twitter Card tags
- [x] Canonical URL is configured

## Risk Assessment

| Risk | Impact | Mitigation |
|------|--------|------------|
| ErrorBoundary breaks SSR | High | Use `"use client"` directive, test SSR |
| Metadata not picked up by Next.js | Medium | Use proper `export const metadata` syntax |
| Twitter card preview fails | Low | Verify with Twitter Card Validator post-deploy |

## Security Considerations
- ErrorBoundary must not expose stack traces in production
- Error logging should not include sensitive data
- Metadata should not expose internal URLs or paths

## Next Steps
After implementation:
1. Deploy and verify with real social media sharing
2. Test error scenarios in production
3. Add analytics tracking for error events (optional)

## Unresolved Questions
None
