# Bug Hunt Report: Post-Login Dashboard Flow
**Date:** 2026-06-29  
**Scope:** Sophia AI Factory post-login user experience  
**Focus Areas:** Dashboard layout, API error handling, sidebar/navigation, land server actions, inngest functions

---

## HIGH Severity Bugs

### 1. Locale-Aware Login Redirect Missing
**File:** `/Users/macbook/projects/sophia-ai-factory/apps/sophia-ai-factory/src/app/[locale]/dashboard/layout.tsx:68`  
**Severity:** HIGH  
**What Breaks:** User redirected to `/login` instead of `/en/login` or `/vi/login`, causing 404 or wrong locale

```typescript
if (!currentUser) redirect('/login');  // Missing locale prefix
```

**Impact:** After login, if session expires or user is unauthenticated, they get redirected to a non-existent route (since app uses locale-prefixed routing with `localePrefix: 'always'`). User sees 404 page instead of login.

---

### 2. fetchJson Utility Doesn't Distinguish Auth Errors
**File:** `/Users/macbook/projects/sophia-ai-factory/apps/sophia-ai-factory/src/seed/utils/fetch-json.ts:10-17`  
**Severity:** HIGH  
**What Breaks:** Components silently fail on 401/403 instead of prompting re-authentication

```typescript
export async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { credentials: 'include' });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`HTTP ${res.status} on ${url}: ${text.slice(0, 200)}`);
  }
  return (await res.json()) as T;
}
```

**Impact:** 
- `SidebarQuotaWidget` (line 44) returns `null` on error, hiding quota display silently
- `HealthIndicator` (line 26) shows "Status Unknown" but doesn't prompt login
- User has no indication their session expired or they need to re-authenticate

---

### 3. Mission Control Data Missing 401 Handling
**File:** `/Users/macbook/projects/sophia-ai-factory/apps/sophia-ai-factory/src/forest/components/dashboard/mission-control/use-mission-control-data.ts:23-24`  
**Severity:** HIGH  
**What Breaks:** Session expiration shows generic error instead of login prompt

```typescript
const res = await fetch('/api/v1/dashboard/mission-control', { cache: 'no-store' });
if (!res.ok) throw new Error('Failed to load mission control data');
```

**Impact:** User sees "Failed to load mission control data" with retry button. Retrying won't help if session expired. Should detect 401 and redirect to login.

---

### 4. Dashboard Page Masks Data Fetch Failures
**File:** `/Users/macbook/projects/sophia-ai-factory/apps/sophia-ai-factory/src/components/stitch/screens/dashboard/dashboard-page.tsx:45-101`  
**Severity:** HIGH  
**What Breaks:** Users see fake "0" metrics instead of error state or loading state

```typescript
const metrics: DashboardMetric[] = initialData?.metrics || [
  { id: 'total_campaigns', value: '0', change: '0%', trend: 'neutral', icon: 'Megaphone' },
  // ... more fake fallback data
];
```

**Impact:** When `initialData` is undefined (data fetch failed), dashboard shows all zeros with hardcoded fake affiliate data. User thinks they have no activity instead of seeing an error. No loading skeleton either, causing flash of empty content.

---

### 5. Locale Switching Loses Current Page
**File:** `/Users/macbook/projects/sophia-ai-factory/apps/sophia-ai-factory/src/forest/components/dashboard/plan-upgrade-widget.tsx:71`  
**Severity:** HIGH  
**What Breaks:** User on `/dashboard/analytics` redirected to `/dashboard` after checkout

```typescript
window.location.href = `/${locale}/dashboard?handover=${data.handoverId}`;
```

**Impact:** After completing a checkout/purchase, user loses their current page context and is sent back to dashboard home instead of the page they were on.

---

### 6. SidebarQuotaWidget Silently Fails on Auth Errors
**File:** `/Users/macbook/projects/sophia-ai-factory/apps/sophia-ai-factory/src/forest/components/dashboard/sidebar-quota-widget.tsx:44`  
**Severity:** HIGH  
**What Breaks:** Quota widget disappears on session expiration with no user feedback

```typescript
if (isLoading || isError || !data) return null;
```

**Impact:** When user's session expires, the quota widget simply vanishes from the sidebar. No error message, no login prompt. User has no idea why their quota information disappeared.

---

## MEDIUM Severity Bugs

### 7. Promise.all in Dashboard Layout Has No Error Resilience
**File:** `/Users/macbook/projects/sophia-ai-factory/apps/sophia-ai-factory/src/app/[locale]/dashboard/layout.tsx:70-76`  
**Severity:** MEDIUM  
**What Breaks:** Single DB query failure crashes entire dashboard load

```typescript
const [trialEndsAt, userTier, redeemedCode] = currentUser
  ? await Promise.all([
      getUserTrialEndsAt(currentUser.id),
      resolveUserTier(currentUser.id),
      getRedeemedPromoCode(currentUser.id),
    ])
  : [null, null, null];
```

**Impact:** If any one of the three parallel DB queries fails (D1 hiccup, network blip), the entire dashboard layout crashes. No Promise.allSettled fallback. User sees error page instead of partial dashboard.

---

### 8. Inngest Function Assumes User Exists Without Check
**File:** `/Users/macbook/projects/sophia-ai-factory/apps/sophia-ai-factory/src/forest/inngest/functions/conversion-to-ledger.ts:74-76`  
**Severity:** MEDIUM  
**What Breaks:** Deleted users cause commission calculation errors

```typescript
const row = await db
  .prepare(`SELECT tier FROM users WHERE id = ? LIMIT 1`)
  .bind(conversion.affiliate_id)
  .first<{ tier: string }>();
return row?.tier ?? 'BASIC';
```

**Impact:** If affiliate user is deleted but conversion events still exist, this defaults to 'BASIC' tier silently. Could cause incorrect commission calculations or payout errors. No validation that user actually exists.

---

### 9. Error Boundary Uses Full Page Reload for Login Redirect
**File:** `/Users/macbook/projects/sophia-ai-factory/apps/sophia-ai-factory/src/app/[locale]/dashboard/error.tsx:70`  
**Severity:** MEDIUM  
**What Breaks:** Jarring full page reload instead of smooth navigation

```typescript
onClick={() => { window.location.href = localizedHref(locale, "/login"); }}
```

**Impact:** When auth error occurs, user gets full page reload instead of Next.js client-side navigation. Loses any in-memory state, feels like a hard crash.

---

### 10. Dashboard Sub-Pages Duplicate Auth Checks
**Files:** Multiple files including:
- `/Users/macbook/projects/sophia-ai-factory/apps/sophia-ai-factory/src/app/[locale]/dashboard/page.tsx:49`
- `/Users/macbook/projects/sophia-ai-factory/apps/sophia-ai-factory/src/app/[locale]/dashboard/settings/page.tsx:25`
- `/Users/macbook/projects/sophia-ai-factory/apps/sophia-ai-factory/src/app/[locale]/dashboard/advisor/page.tsx:35`

**Severity:** MEDIUM  
**What Breaks:** Inconsistent auth handling across dashboard pages

```typescript
if (!user) redirect('/login');  // Repeated in 10+ files
```

**Impact:** Each sub-page duplicates the same auth check. If someone updates the redirect logic in one place but forgets others, behavior becomes inconsistent. Already has locale bug (see #1).

---

## LOW Severity Bugs

### 11. Sidebar Active State Detection Could Mismatch
**File:** `/Users/macbook/projects/sophia-ai-factory/apps/sophia-ai-factory/src/forest/components/dashboard/dashboard-sidebar-nav.tsx:51-59`  
**Severity:** LOW  
**What Breaks:** Active link highlighting might not work correctly with locale prefix

```typescript
const cleanPath = pathname ? pathname.replace(/^\/(en|vi)/, "") || "/" : "/";
const cleanHref = href.replace(/^\/(en|vi)/, "") || "/";
```

**Impact:** Strips locale prefix from pathname but hrefs are hardcoded without locale. Works currently but fragile if routing changes.

---

### 12. No Loading Skeleton for Dashboard Page
**File:** `/Users/macbook/projects/sophia-ai-factory/apps/sophia-ai-factory/src/app/[locale]/dashboard/page.tsx`  
**Severity:** LOW  
**What Breaks:** Flash of empty/unstyled content during initial load

**Impact:** Dashboard page has no `loading.tsx` file. Users see a brief flash of empty content before data loads. Mission control widget has skeleton, but main dashboard page doesn't.

---

## Summary

**Critical Findings:**
- 6 HIGH severity bugs affecting auth flow, error handling, and user experience
- 4 MEDIUM severity bugs affecting resilience and consistency  
- 2 LOW severity bugs affecting polish

**Top Priority Fixes:**
1. Fix locale-aware redirect in dashboard layout (#1)
2. Add 401/403 detection to fetchJson and all API calls (#2, #3)
3. Replace hardcoded fallback data with proper loading/error states (#4)
4. Preserve current page in locale switching (#5)
5. Add Promise.allSettled for dashboard parallel queries (#7)

**Unresolved Questions:**
- Should sidebar quota widget show "Login required" state instead of disappearing?
- Should mission control data fetch redirect on 401 or show inline login prompt?
- Should error boundaries use router.push instead of window.location for SPA feel?
- Are there other API endpoints that need 401 handling besides the ones found?
