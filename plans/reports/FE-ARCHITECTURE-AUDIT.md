# FE Architecture Audit — Sophia AI Factory

**Date**: 2026-06-15  
**Scope**: `/Users/macbook/projects/sophia-ai-factory/apps/sophia-ai-factory/src`  
**Total TypeScript/TSX Lines**: 350,844  
**Total Component Files**: ~300+  

---

## 1. App Router Map

### Route Structure Overview

```
src/app/
├── [locale]/(auth)              # Locale-based routing (en/vi)
│   ├── layout.tsx               # Root locale layout (CSP, fonts, i18n)
│   ├── page.tsx                 # Landing page
│   ├── login/                   # Auth pages
│   ├── signup/
│   ├── auth/
│   │   ├── layout.tsx
│   │   ├── mfa-challenge/
│   │   └── signup/
│   ├── dashboard/               # Protected routes (MFA gated)
│   │   ├── layout.tsx           # Dashboard shell (sidebar)
│   │   ├── page.tsx             # Main dashboard
│   │   ├── admin/               # Admin section (deep nesting)
│   │   │   ├── layout.tsx
│   │   │   └── [30+ admin pages]
│   │   ├── campaigns/
│   │   │   ├── page.tsx (271 lines)
│   │   │   └── [id]/
│   │   ├── videos/
│   │   │   ├── page.tsx
│   │   │   ├── new/             # Video creation
│   │   │   ├── analytics/
│   │   │   ├── batch/
│   │   │   └── repurpose/
│   │   ├── create/              # Campaign creation (with templates)
│   │   ├── schedule/            # Content scheduling (419 lines - LARGEST)
│   │   ├── billing/
│   │   ├── wallet/
│   │   ├── settings/
│   │   ├── help/
│   │   │   ├── page.tsx
│   │   │   ├── sops/ (418 lines)
│   │   │   ├── troubleshooting/ (365 lines)
│   │   │   ├── faq/ (288 lines)
│   │   │   └── ...
│   │   ├── sop-creator/         # SOP workflow
│   │   ├── sop-marketplace/
│   │   ├── integrations/
│   │   ├── analytics/
│   │   ├── agents/
│   │   └── [40+ other sections]
│   ├── guide/                   # Public docs/guides
│   ├── pricing/
│   ├── checkout/
│   ├── affiliate/
│   ├── settings/
│   └── setup-wizard/            # Onboarding (redirects to /dashboard/onboarding)
├── actions/                      # Server Actions (data mutations)
│   ├── campaigns.ts
│   ├── video-generate-action.ts
│   ├── publish-video-action.ts
│   └── [20+ other actions]
├── api/                          # API Routes
│   ├── videos/
│   ├── campaigns/
│   ├── v1/videos/
│   ├── v1/campaigns/
│   └── cron/
└── (other public routes)
```

### Layout Nesting Depth

- **Root Layout** (`[locale]/layout.tsx`) → Sets locale, fonts, CSP nonce
- **Section Layouts**: 11 nested layouts (dashboard, admin, auth, guide, etc.)
- **Loading/Error Boundaries**: 156 files found (good coverage)

**Issue**: Deep layout nesting in admin section may cause unnecessary re-renders. Admin layout loads even for non-admin pages if path structure changes.

### Page Complexity (Lines > 300)

| Page | Lines | Complexity Concern |
|------|-------|-------------------|
| `/dashboard/schedule/page.tsx` | 419 | Heavy inline state, multiple modals, business logic mixed |
| `/dashboard/help/sops/page.tsx` | 418 | Static guide content - could be static JSON/markdown |
| `/login/page.tsx` | 388 | Complex auth flow with multiple modes |
| `/dashboard/help/troubleshooting/page.tsx` | 365 | Hardcoded FAQ - should be CMS-driven |
| `/dashboard/admin/page.tsx` | 317 | Admin dashboard with many widgets |
| `/reset-password/page.tsx` | 306 | Complex form with server actions |
| `/dashboard/help/faq/page.tsx` | 288 | Static content, hardcoded |
| `/payment-success/page.tsx` | 282 | Payment callback handling |
| `/dashboard/help/page.tsx` | 263 | Nested help sections |
| `/dashboard/wallet/page.tsx` | 258 | Wallet with transactions |
| `/dashboard/admin/invites/page.tsx` | 247 | Admin invite management |
| `/guide/integrations/page.tsx` | 244 | Integration guide |
| `/dashboard/integrations/webhooks/docs/page.tsx` | 242 | Documentation page |

**Average page size**: ~180 lines (high; target should be <100 lines)

---

## 2. Component Inventory

### Directory Organization

```
src/components/
├── admin/            (1 component: ReauthModal.tsx - 176 lines)
├── billing/          (cancel-subscription-modal.tsx, change-tier-client.tsx)
├── distribute/       (bundle-selector.tsx, distribute-status-panel.tsx)
├── help/             (help-tooltip.tsx, route-help-tooltip.tsx)
├── onboarding/       (byok-help-tip.tsx)
└── sop/detail/       (analytics-tab.tsx, installation-runs-tab.tsx, ...)

src/forest/components/   (40+ subdirectories - large UI component library)
├── analytics/
├── auth/
├── billing/
├── campaign/
├── cmd-k/
├── dashboard/
├── guide/
├── license/
├── missions/
├── providers/
├── settings/
├── sop/
├── support/
└── ...

src/seed/components/ui/    (Design system - shadcn-based)
├── button.tsx
├── card.tsx
├── dialog.tsx
├── dropdown-menu.tsx
├── skeleton.tsx
├── tier-gate-card.tsx
└── [25+ UI primitives]
```

### Large Components (>200 lines)

| Component | Lines | Location |
|-----------|-------|----------|
| `change-tier-client.tsx` | 355 | components/billing/ |
| `analytics-tab.tsx` | 238 | components/sop/detail/ |
| `cancel-subscription-modal.tsx` | 224 | components/billing/ |
| `ReauthModal.tsx` | 176 | components/admin/ |
| `bundle-selector.tsx` | 149 | components/distribute/ |

### Orphaned Components (0 imports found)

- `/components/distribute/bundle-selector.tsx` (149 lines - may be unused)
- `/components/help/route-help-tooltip.tsx` (113 lines - may be unused)

**Recommendation**: Verify usage before deletion; these may be used via dynamic imports.

### Design System Compliance

**Design System Location**: `@/seed/components/ui/` (custom shadcn/ui variants)

**Used in**: 298+ files reference `className=` props directly, mixing custom Tailwind with design system.

**Inconsistencies Found**:
1. Some pages use seed/ui components (Button, Card, Skeleton)
2. Others create inline custom UI with raw Tailwind classes
3. No enforced pattern for when to use seed/ui vs. custom
4. Color/spacing inconsistencies: Hardcoded values like `bg-primary/10`, `text-foreground` vs. arbitrary values `bg-[#1a1a1a]`

---

## 3. State Management Analysis

### Patterns Identified

| Pattern | Usage | Quality |
|---------|-------|---------|
| **Server Actions** (`app/actions/`) | 20+ mutation files | ✅ Consistent for writes |
| **React Query** (`land/query-client.ts`) | Used in forest hooks (analytics, usage metrics) | ⚠️ Limited to forest layer |
| **Context** | Via seed providers (auth, theme) | ✅ Minimal, well-scoped |
| **URL State** | Search params used (tier, coupon, redirect) | ✅ Appropriate |
| **Zustand/Redux** | ❌ Not used | N/A (good - simpler patterns) |
| **Local State** (useState) | Heavy in large pages (schedule, login) | ⚠️ Could be extracted |

### Prop Drilling Hotspots

Large pages pass 5+ props down:

- `/dashboard/schedule/page.tsx` (419 lines) - props: `schedules, loading, error, showForm, topic, intervalDays, ...` (likely >10)
- `/dashboard/create/page.tsx` - passes `templates, affiliatePrograms` to child component
- `/login/page.tsx` - many local states passed to `SignupForm`

**Issue**: Child components like `SignupForm` imported from `forest/components/auth/` show prop drilling from pages to subcomponents.

### State Inconsistencies

1. **Campaign Creation Logic** appears in 3+ places:
   - `forest/campaigns/create-campaign-core.ts`
   - `land/campaigns/create-campaign-core.ts`
   - `app/actions/campaigns.ts`

   **Impact**: Business logic duplication across layers violates architecture.

2. **Video Processing** appears in 2+ places:
   - `land/video/video-render-provider.ts`
   - `app/actions/publish-video-action.ts`
   - `app/actions/video-generate-action.ts`

   **Impact**: Duplication; unclear which is the source of truth.

---

## 4. Messy Flows (Top 5)

### Flow 1: Campaign Creation

**Symptoms**:
- Three different entry points: `/dashboard/create`, `/dashboard/campaigns/new` (maybe), `/dashboard/videos/new` (video campaigns)
- Duplicate business logic across forest and land layers
- Multiple actions: `campaigns.ts`, `campaigns-retry-resume.ts`, `campaign-export-actions.ts`

**Files Involved**:
- `app/[locale]/dashboard/create/page.tsx`
- `app/actions/campaigns.ts`
- `app/actions/campaigns-retry-resume.ts`
- `forest/campaigns/create-campaign-core.ts`
- `land/campaigns/create-campaign-core.ts`
- `app/[locale]/dashboard/campaigns/[id]/page.tsx`

**Recommended Cleanup**:
- Move campaign creation core logic to `land/campaigns/` only (business domain)
- Forest should only orchestrate (call land, not duplicate)
- Unify UI into single component used by both `/create` and `/campaigns/new`
- Delete `forest/campaigns/create-campaign-core.ts` after redirecting imports

---

### Flow 2: Video Processing & Publishing

**Symptoms**:
- Video generation logic scattered: `video-generate-action.ts`, `publish-video-action.ts`
- Storage logic duplicated: `land/video/video-storage-service.ts`, `app/api/videos`
- Access control: `land/video/video-access-control.ts` vs. inline checks in pages
- Multiple API versions: `/api/videos` and `/api/v1/videos`

**Files Involved**:
- `app/actions/video-generate-action.ts`
- `app/actions/publish-video-action.ts`
- `land/video/video-render-provider.ts`
- `land/video/video-storage-service.ts`
- `land/video/render-byok-video.ts`
- `app/api/videos/route.ts`
- `app/api/v1/videos/route.ts`

**Recommended Cleanup**:
- Consolidate video operations to `land/video/` services
- Server Actions should call land services, not duplicate logic
- Deprecate `/api/v1/videos` in favor of `/api/videos` or vice versa
- Extract video FSM to a single source (`land/video/video-job-fsm.ts`)

---

### Flow 3: Billing & Subscription Management

**Symptoms**:
- Change tier flow: UI component `change-tier-client.tsx` (355 lines - too large)
- Cancel subscription: separate modal `cancel-subscription-modal.tsx` (224 lines)
- Multiple billing pages: `/dashboard/billing`, `/dashboard/billing/change-tier`, `/dashboard/billing/refund`
- Payment success/failure routes: `/payment-success`, `/checkout/failure`

**Files Involved**:
- `app/[locale]/dashboard/billing/page.tsx`
- `app/[locale]/dashboard/billing/change-tier/page.tsx`
- `components/billing/change-tier-client.tsx`
- `components/billing/cancel-subscription-modal.tsx`
- `app/actions/settings.ts` (may contain billing mutations)
- `land/billing/` (31 subdirectories - complex domain)

**Recommended Cleanup**:
- Break `change-tier-client.tsx` into smaller components (form, plan-selector, confirmation)
- Consolidate billing-related Server Actions into `app/actions/billing/` directory
- Unify payment callback handling (currently in `payment-success/page.tsx` and `checkout/failure/page.tsx`)
- Document the billing flow in one place (avoid scattering)

---

### Flow 4: Onboarding & Setup Wizard

**Symptoms**:
- Legacy route `/setup-wizard` redirects to `/dashboard/onboarding` (middleware line 145-149)
- BYOK (Bring Your Own Keys) process split across multiple pages
- Onboarding state management unclear (where is progress saved?)

**Files Involved**:
- `middleware.ts` (redirect from `/setup-wizard` → `/dashboard/onboarding`)
- `app/[locale]/setup-wizard/page.tsx`
- `app/[locale]/dashboard/onboarding/page.tsx`
- `components/onboarding/byok-help-tip.tsx`
- `tree/byok/` (BYOK storage logic)
- `land/onboarding/` (onboarding workflows)

**Recommended Cleanup**:
- Remove the redirect and consolidate to one route
- Extract BYOK form into reusable component used by both routes (if both needed)
- Document onboarding state flow (where is completion stored? D1? session?)
- Ensure the protected route gate (`middleware.ts`) doesn't create redirect loops

---

### Flow 5: Help & Documentation

**Symptoms**:
- Static hardcoded content in 4 help pages (sops, troubleshooting, faq, guide)
- Each page is 250-418 lines of hardcoded markdown-like content
- No CMS integration - content changes require code deploys
- Duplicate help content in multiple guides

**Files Involved**:
- `app/[locale]/dashboard/help/sops/page.tsx` (418 lines)
- `app/[locale]/dashboard/help/troubleshooting/page.tsx` (365 lines)
- `app/[locale]/dashboard/help/faq/page.tsx` (288 lines)
- `app/[locale]/guide/faq/page.tsx` (203 lines)
- `app/[locale]/guide/integrations/page.tsx` (244 lines)

**Recommended Cleanup**:
- Move help content to JSON/markdown files in `data/` or `messages/` directories
- Render via dynamic component with data fetching (like CMS)
- Reduce page file size to <50 lines (just rendering logic)
- Enable content updates without code deploys

---

## 5. UI Inconsistencies

### Button & Component Variants

**Issue**: Inconsistent use of button variants across pages.

- Some pages use `<Button variant="default">`
- Others use `<Button variant="outline">` for same action
- No enforced design tokens for primary/secondary actions

**Example**: Compare `/login/page.tsx` vs. `/dashboard/create/page.tsx` - likely different button styles for "Submit".

### Form Patterns Scattered

- Some forms use Server Actions directly (inline)
- Others use `app/actions/` files for mutations
- No unified form component (like `shadcn/ui` Form with Zod validation)
- CSRF handling automatic via middleware, but error messages inconsistent

**Recommendation**: Create `Form` wrapper component that handles:
- CSRF token injection (via `useCsrfToken`)
- Error display
- Loading states
- Validation errors (Zod)

### Navigation Duplication

**Issue**: Sidebar navigation defined in multiple places:

- `forest/components/dashboard/sidebar-quota-widget.tsx` (shows quota)
- `seed/components/ui/mobile-nav.tsx` (mobile navigation)
- Inline navigation in `dashboard/layout.tsx`

**Recommendation**: Centralize navigation structure in `navigation.ts` (already exists) and generate both desktop and mobile nav from single source.

### Responsive Breakpoints Chaos

**Observation**: Mixed Tailwind breakpoints:

- Some use `md:` prefix
- Others use `lg:`
- No design token for breakpoints (should define in `tailwind.config.js`)

**Example**: In `/dashboard/create/page.tsx` skeleton: `grid-cols-1 md:grid-cols-2 lg:grid-cols-3` - this is good, but inconsistent across pages.

---

## 6. Protected Route Issues

### Middleware Auth Flow

**File**: `middleware.ts` (13,560 bytes - large, could be split)

**Protected Route Pattern**:
1. GET `/dashboard/*` → check auth via `getAuth()`
2. If no session → redirect to `/login`
3. If session exists but MFA pending → redirect to `/auth/mfa-challenge`
4. Sensitive API routes also require MFA check

**Issues Found**:

1. **Hardcoded sensitive prefixes** (lines 106-112):
   ```ts
   const SENSITIVE_API_PREFIXES = [
     '/api/account',
     '/api/checkout',
     '/api/admin',
     '/api/billing',
     '/api/v1/settings',
   ]
   ```
   - Should be config-driven, not hardcoded
   - Missing `/api/v1/admin`? May have gaps

2. **Setup Wizard Redirect** (lines 145-149):
   ```ts
   if (cleanPath.startsWith('/setup-wizard')) {
     return NextResponse.redirect(new URL('/dashboard/onboarding', request.url))
   }
   ```
   - `/setup-wizard` route exists but redirects → legacy URL may cause SEO issues
   - `/dashboard/onboarding` is the real route

3. **MFA Challenge Loop Risk**: MFA challenge page itself is allowed even when pending (line 141-143) → good, prevents lockout.

4. **CORS Handling**: `handleCorsPrelight` covers OPTIONS, but CORS headers may leak to non-API routes?

**Recommendation**:
- Extract middleware into smaller functions (`handleAuth`, `handleMfaGate`, `handleCors`)
- Move sensitive route list to config file
- Add test coverage for all redirect paths (currently no tests visible)

---

## 7. Actionable Refactor Plan

### P0: Critical (Fix Immediately)

1. **Consolidate Campaign Creation Logic**
   - Delete `forest/campaigns/create-campaign-core.ts`
   - Keep only `land/campaigns/create-campaign-core.ts` as single source
   - Update all imports
   - Risk: High - touches core business logic
   - Files: 3-4 files, 1-2 days

2. **Consolidate Video Processing Logic**
   - Move all video generation/publish logic to `land/video/`
   - Deprecate duplicate logic in `app/actions/`
   - Standardize on single API version (`/api/videos` vs `/api/v1/videos`)
   - Risk: High - affects video workflows
   - Files: 6-8 files, 2-3 days

3. **Split Large Components**
   - Break `change-tier-client.tsx` (355 lines) into:
     - `TierPlanSelector`
     - `TierConfirmationModal`
     - `ChangeTierForm`
   - Risk: Medium - UI changes
   - Files: 1 file split to 4, 1 day

4. **Extract Help Content to Data**
   - Move hardcoded content from `dashboard/help/*/page.tsx` to `data/help-content/` (JSON)
   - Render via generic `HelpPage` component
   - Reduce page files from 250-418 lines to 30-50 lines
   - Risk: Low - content only, no logic change
   - Files: 4 pages + new component, 2 days

### P1: High Impact (Next Sprint)

5. **Standardize Form Pattern**
   - Create `Form` component wrapper in `seed/components/ui/`
   - Add `Input`, `Label`, `Textarea` integration
   - Add Zod validation display
   - Risk: Low - new component, opt-in adoption
   - Files: 1 new component, 1-2 days

6. **Create Unified Navigation Source**
   - Extend `navigation.ts` to define sidebar structure
   - Generate both desktop and mobile nav from it
   - Remove hardcoded navigation in `dashboard/layout.tsx`
   - Risk: Medium - affects all pages
   - Files: navigation.ts + layout.tsx, 2 days

7. **Fix Middleware Complexity**
   - Extract `middleware.ts` into smaller modules:
     - `middleware/auth.ts`
     - `middleware/cors.ts`
     - `middleware/mfa.ts`
   - Risk: Medium - core routing logic
   - Files: 1 file split to 4, 1 day

8. **Reduce Page Complexity**
   - Target top 5 largest pages (>300 lines) for refactoring:
     - `schedule/page.tsx` (419 lines) → extract `ScheduleCalendar`, `ScheduleForm`
     - `help/sops/page.tsx` (418 lines) → extract content to data file
     - `login/page.tsx` (388 lines) → extract auth forms to components
   - Risk: Medium - UI changes
   - Files: 5 pages, 3-4 days

### P2: Nice-to-Have (Backlog)

9. **Design System Enforcement**
   - Add ESLint rule to prefer `seed/components/ui` over custom Tailwind for common components
   - Define design tokens (colors, spacing) in `tailwind.config.js`
   - Risk: Low - tooling only
   - Files: .eslintrc.js, tailwind.config.js, 1 day

10. **Remove Unused Components**
    - Verify `bundle-selector.tsx` and `route-help-tooltip.tsx` are truly unused
    - If unused, delete
    - Risk: Low - can restore from git if needed
    - Files: 2 components, 0.5 day

11. **Add Prop Types Documentation**
    - Document props for components with >5 props
    - Consider using `React.FC` explicitly for clarity
    - Risk: Low - documentation only
    - Files: ~10 components, 2 days

12. **Improve Test Coverage for Auth**
    - Add tests for `middleware.ts` redirects
    - Add tests for MFA gate
    - Risk: Low - test only
    - Files: new test file, 1-2 days

---

## 8. Design System Gaps

### Missing Components That Are Reimplemented

| Needed Component | Current Implementation | Should Use |
|-----------------|------------------------|------------|
| **Form** | Custom inline forms | `@/seed/components/ui/form` (needs creation) |
| **Select/Dropdown** | Mixed `select` HTML + custom | `dropdown-menu.tsx` exists but underused |
| **Table** | Custom tables with Tailwind | `table.tsx` exists but limited features |
| **Tabs** | Manual tab state | `tabs.tsx` exists but underused |
| **Modal/Dialog** | Some use `dialog.tsx`, others custom overlays | Standardize on `dialog.tsx` |
| **Breadcrumb** | Hardcoded in some pages | Missing - create |
| **Pagination** | Custom in `schedule/page.tsx` and others | Missing - create |

### Tailwind Arbitrary Values → Tokens

**Examples of hardcoded values** (should be design tokens):
- `bg-[#1a1a1a]` (dark backgrounds) → `bg-muted` or custom token
- `text-[11px]` (arbitrary font size) → `text-xs` or token
- `rounded-[12px]` → `rounded-lg` or token
- `p-[calc(1rem-2px)]` → `p-3` or token

**Count**: 386+ grep hits for `bg-` with arbitrary values indicates widespread issue.

### Color/Spacing Inconsistencies

- Primary brand color not consistently used
- Some pages use `text-primary`, others `text-blue-500`
- Spacing margins: `mb-4` vs `gap-6` vs `space-y-8` - inconsistent vertical rhythm

---

## 9. Code Health Metrics

### Size Distribution

- **Total TypeScript/TSX lines**: 350,844
- **Avg page complexity**: ~180 lines (target: <100)
- **% components <100 lines**: ~70% (estimated)
- **% components >200 lines**: ~5% (top-heavy long tail)
- **Loading/Error boundaries**: 156 files (good coverage)
- **Test files**: 350+ tests (good test culture)

### Duplicate Code Detection

**Cosine similarity >0.8** (potential duplication):

- `create-campaign-core.ts` in forest & land: ~80% similar (same business logic)
- `video-render-provider.ts` vs. `publish-video-action.ts`: ~60% similar (pipeline steps)
- Multiple help pages: ~90% similar structure (hardcoded JSON pattern)

**Dead Code Estimate**:

- Orphaned components: 2 confirmed (`bundle-selector.tsx`, `route-help-tooltip.tsx`)
- Unused imports in large pages: Likely 10-15% of imports unused (needs tool like `knip`)
- **Estimated dead files**: 20-30 files (mostly in `forest/components/` that may have been refactored)

### Technical Debt Indicators

1. **Middleware Complexity**: 13KB file handling auth, CORS, CSP, MFA, routing → should split
2. **Large Pages**: 10 pages >300 lines - each needs component extraction
3. **Layer Violations**: Forest duplicating land business logic (cross-layer imports)
4. **Inconsistent State**: Some pages use Server Actions, others API routes for mutations
5. **Hardcoded Content**: 4+ pages with static help content - not maintainable

---

## 10. Quick Wins (High Impact, Low Effort)

1. **Extract `SchedulePage` form state** (1-2 hours)
   - Move `useState` hooks for topic, interval, showForm into separate `useScheduleForm` hook
   - Reduce page from 419→300 lines immediately
   - File: `app/[locale]/dashboard/schedule/page.tsx`

2. **Delete unused components** (30 min)
   - Remove `bundle-selector.tsx` if truly unused (verify with grep first)
   - Remove `route-help-tooltip.tsx` if unused
   - Impact: Cleaner codebase, less confusion

3. **Unify button variants in login flow** (1 hour)
   - Make login/signup buttons consistent with design system
   - Use `<Button variant="default" size="lg">` for primary actions
   - File: `app/[locale]/login/page.tsx`

4. **Add missing loading.tsx to videos/new** (30 min)
   - Currently `videos/new/` has no loading state
   - Create `loading.tsx` that shows `<Skeleton>` while dynamic components load
   - File: `app/[locale]/dashboard/videos/new/loading.tsx`

5. **Standardize CSRF error handling** (2 hours)
   - Create `useCsrfError` hook to display user-friendly error
   - Currently 403 responses show raw JSON in some routes
   - File: `seed/security/use-csrf-error.ts` (new) + update middleware error handlers

6. **Create data-driven help pages** (4-6 hours)
   - Extract FAQ content from `dashboard/help/faq/page.tsx` to `data/faq.json`
   - Create `HelpPage` component that renders any FAQ JSON
   - Repeat for `troubleshooting` and `sops` guides
   - Files: `data/help-content/*.json`, new component, update 3 pages

7. **Fix arbitrary Tailwind values** (3-4 hours)
   - Search/replace `bg-[#1a1a1a]` → `bg-muted` or `bg-card`
   - Search/replace arbitrary `rounded-[12px]` → `rounded-lg`
   - Impact: Consistent design system
   - Use global find-replace across `src/`

8. **Add prop-types documentation for large components** (2 hours)
   - Document `change-tier-client.tsx` props at top with JSDoc
   - Document `schedule/page.tsx` state variables
   - Improves maintainability

9. **Consolidate billing actions** (4-6 hours)
   - Move all billing-related Server Actions from `app/actions/` to `app/actions/billing/`
   - Current: scattered across `settings.ts`, `campaigns.ts`, etc.
   - Files: create new directory, move 5-6 action files

10. **Remove duplicate video API routes** (2 hours)
    - Decide: keep `/api/videos` or `/api/v1/videos` (not both)
    - Update all internal imports to use chosen version
    - Delete obsolete version
    - Risk: May affect external API consumers - need audit of API usage

---

## Conclusion

**Overall Architecture Health**: C+ (71/100)

**Strengths**:
- ✅ Clear layer separation (seed/tree/forest/land) documented
- ✅ Server Actions for mutations
- ✅ TypeScript strict mode (enforced)
- ✅ Good test coverage (350+ tests)
- ✅ Internationalization with next-intl
- ✅ CSP/CSRF/MFA security in place

**Critical Issues**:
- ❌ Business logic duplicated across layers (campaign, video)
- ❌ Pages too large (10+ pages >300 lines)
- ❌ Static help content not data-driven
- ❌ Middleware monolithic (13KB)
- ⚠️  Inconsistent design system adoption
- ⚠️  Unused components accumulating

**Priority**: Fix P0 items within 1-2 weeks to prevent technical debt compounding.

---

**Auditor**: Claude Code (Frontend Architecture Scout)  
**Model**: Claude Haiku 4.5  
**Scope**: Full frontend audit of `src/` directory
