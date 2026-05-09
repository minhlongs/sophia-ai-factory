# Code Review — Wave 4 (F-1 to F-8)

- Date: 2026-05-08 20:43
- Reviewer: code-reviewer
- Score: **8.6 / 10**
- Critical: 0 (1 HIGH that must ship-block)
- Tests: 2810/2810 pass · tsc: 0 · i18n parity: en/vi 1944 calls / 850 keys

## Scope

| File | Wave 4 | LOC |
|---|---|---:|
| `src/app/[locale]/(admin)/admin/users/page.tsx` | F-1 | 66 |
| `src/app/[locale]/(admin)/admin/users/admin-users-client.tsx` | F-2 | — |
| `src/forest/components/settings/sections/{profile,appearance,notifications,api-keys}-section.tsx` | F-3 | 60–113 |
| `src/forest/components/raas/mission-detail.tsx` | F-4, F-7 | 193 |
| `src/forest/components/missions/agent-team-panel.tsx` | F-5 | 101 |
| `src/app/[locale]/dashboard/components/onboarding-tour-modal.tsx` | F-6 | **243** |
| `src/forest/components/raas/mission-dashboard.tsx` | F-7 | 137 |
| `src/app/sitemap.ts` | F-8 | — |
| `messages/{en,vi}.json` | F-3, F-4 | parity ✓ |

## Verdict per fix

| F | Status | Notes |
|---|---|---|
| F-1 admin tier from DB | ⚠️ HIGH (logic gap) | Re-implements `getUserTier()` poorly — see H-1 |
| F-2 drop prompt() Basic Auth | ✅ Correct | `requireAdmin()` validates session server-side; `credentials: 'same-origin'` redundant but safe |
| F-3 settings i18n (4 sections) | ✅ Solid | en/vi key parity verified; KEY_CONFIGS shape change preserves IDs and helpUrls |
| F-4 retry CTA | ❌ HIGH (404) | Endpoint missing — see H-2 |
| F-5 agent-team CTA | ✅ Solid | `<a mailto:>` replaces dead `window.location.href` |
| F-6 onboarding locale prefix | ✅ Correct | Matches middleware `defaultLocale: 'en'` + `localePrefix: 'as-needed'` |
| F-7 toLocaleString locale | ✅ Correct | `vi-VN` / `en-US` are valid BCP47 |
| F-8 sitemap clarification | ✅ Correct | Comment-only; no behavior change |

## HIGH

### H-1 — F-1 reinvents `getUserTier()` with weaker semantics
**File:** `src/app/[locale]/(admin)/admin/users/page.tsx:30-51`

The N+1 `Promise.all` of single-row `subscriptions` queries:
1. Does NOT filter `WHERE status = 'active'` → may surface cancelled/expired plans as current.
2. Selects only `plan`, ignoring `tier` column. Per `seed/db/get-user-tier.ts:51-52`, **tier column is canonical**, plan is fallback alias.
3. Skips org-based fallback (`org_members` join) used by `getUserTier()` line 56-66 — BC for org-scoped customers.
4. N round-trips per page render scales poorly (mentioned in prompt).

**Fix:** Replace inline subquery with `getUserTier(u.id)` from `@/seed/db/get-user-tier`. Same Promise.all semantics, but uses the audited canonical resolver:

```ts
import { getUserTier } from '@/seed/db/get-user-tier';
// ...
const tiers = await Promise.all(userRows.map((u) => getUserTier(u.id)));
userRows.forEach((u, i) => tierMap.set(u.id, tiers[i]));
```

Future O(1)-batch optimization (when N>100): single `SELECT user_id, tier, plan FROM subscriptions WHERE user_id IN (?, ?, ...) AND status = 'active'` then in-memory join — but `getUserTier()` is correct enough for typical admin lists.

### H-2 — F-4 retry endpoint does NOT exist
**File:** `src/forest/components/raas/mission-detail.tsx:96`

```bash
ls src/app/api/raas/missions/
# → [id]/route.ts, route.ts   (NO retry/route.ts)
```

POST `/api/raas/missions/{id}/retry` will 404. The component DOES handle non-OK responses (`!res.ok` → throws, sets `retryError`), so it fails gracefully — user sees "HTTP 404" toast. But the retry button is **non-functional in production**.

**Two options:**
- (a) Ship the route now: `src/app/api/raas/missions/[id]/retry/route.ts` — pattern already exists for `[id]/route.ts`. Should re-launch the mission via existing PEV pipeline.
- (b) Hide the button until backend lands: gate on a feature flag or `mission.retry_supported` field.

Shipping (a) is preferred since UI is already wired and i18n keys committed. Until then this is **HIGH** because the visible CTA misleads users into thinking retry works.

## MEDIUM

### M-1 — `onboarding-tour-modal.tsx` exceeds 200 LOC limit
**File:** `src/app/[locale]/dashboard/components/onboarding-tour-modal.tsx` (243 LOC)

Pre-existing condition; Wave 4 added 4 lines (router/locale plumbing). Sophia rule §File Size mandates ≤200. Split STEPS array + handlers into sibling files (`onboarding-steps.ts`, `use-onboarding-nav.ts`).

### M-2 — i18n drift opportunity for retry/contact_support
**Files:** `messages/{en,vi}.json` lines 499-502 (`dashboard.missions.retry|retrying|retry_error|contact_support`)

Keys are placed at top of `dashboard.missions` namespace alongside `progress` block, but the `MissionDetail` consumer reads them via `t('retry')`. Locations correct. No drift, but consider grouping under `dashboard.missions.retry.{button, error, supportLink}` for future-proofing — easier to extend (e.g., add `retry.cooldown`).

### M-3 — F-6 SPA navigation may break tour completion telemetry
**File:** `onboarding-tour-modal.tsx:117-120`

`router.push(localized)` is async-fire-and-forget after `await handleFinish()`. If `handleFinish()` writes a `tour_completed_at` to DB, ensure that DB write completes before navigation triggers cache invalidation on the destination route. Current code awaits `handleFinish()` first — looks correct. Add a unit test asserting completion fires before push.

### M-4 — F-7 locale list hardcoded twice
**Files:** `mission-detail.tsx:43`, `mission-dashboard.tsx:50`

```ts
const dateLocale = locale === 'vi' ? 'vi-VN' : 'en-US';
```

When a third locale is added (`th`, `id`, etc.), this falls back to en-US silently. Extract to `src/seed/i18n/date-locale.ts`:

```ts
export function toBcp47(locale: string): string {
  const map: Record<string, string> = { vi: 'vi-VN', en: 'en-US', th: 'th-TH' };
  return map[locale] ?? 'en-US';
}
```

DRY win across both components (and any future date renders).

## LOW

- **L-1 (F-2)** `credentials: 'same-origin'` is the fetch default — explicit but redundant. Keep for clarity.
- **L-2 (F-3 api-keys)** `KEY_CONFIGS` `label` field still hardcoded ("OpenAI / OpenRouter", "ElevenLabs"…). These are brand names — fine to leave un-translated, but if Vietnamese marketing wants localized "AI Hình Ảnh" descriptors, add `labelKey`.
- **L-3 (F-4)** `window.location.reload()` after retry success is heavy-handed; `mutate()` (SWR) or refetch the mission would be smoother — non-blocking.
- **L-4 (F-5)** `mailto:support@agencyos.network?subject=Request%20Agent%20Team` URL-encodes correctly. Consider templating the subject from i18n for vi locale.
- **L-5 (sitemap)** Comment is fine, but the absence of `/blog/[slug]` routes could be enforced by a test asserting `/blog/POST_SLUG` returns 404 (or redirects to guide). Out of scope.

## Edge cases (scout findings)

| # | Risk | File:Line | Severity |
|---|---|---|---|
| E-1 | Subscription with `status='cancelled'` shows tier as if active | `users/page.tsx:39` | HIGH (folded into H-1) |
| E-2 | Org-scoped user shows `BASIC` because user_id has no row | `users/page.tsx:35-50` | HIGH (folded into H-1) |
| E-3 | Locale === undefined in F-6 → falls through to non-prefixed (matches `en` default) | `onboarding-tour-modal.tsx:118` | LOW (acceptable) |
| E-4 | `defaultLocale` mismatch: `src/i18n.ts: 'vi'` vs `middleware.ts: 'en'` | both | MEDIUM pre-existing — outside Wave 4 scope, but flag for housekeeping |
| E-5 | F-4 retry double-click race (button disabled via `retrying` state) | `mission-detail.tsx:88-101` | OK — guarded |
| E-6 | i18n key mismatch between `t('retry_error')` fallback and Error.message | `mission-detail.tsx:106` | LOW — Error message wins, fallback only on non-Error throw |

## Positive observations

- F-3 KEY_CONFIGS refactor preserves stable `id` (used for form binding) — no breaking change to react-hook-form state.
- F-2 explicitly comments WHY no Basic Auth (server-side `requireAdmin`) — future maintainers won't add it back.
- F-4 retry-state machine (idle → retrying → error|reload) is clean; error has `role="alert"` for a11y.
- en/vi parity: 30 new keys, all matched. Vietnamese strings use proper diacritics (Hồ Sơ, Bảo mật).
- Zero `:any` introduced. Zero new `console.*`. Zero new `@ts-ignore`.
- `dateLocale` choice (`vi-VN`/`en-US`) matches Intl spec — `Intl.DateTimeFormat.supportedLocalesOf(['vi-VN','en-US'])` returns both.
- `mailto:` fallbacks (F-4 contact_support, F-5 agent-team) safer than fake redirects.

## Metrics

- Type coverage: 100% (no new `:any`)
- Test coverage: unchanged (no test changes; Wave 4 deltas are UI/i18n)
- Linting: 0 new issues
- LOC delta: ~+115 lines (mostly i18n keys + retry button + per-user query)
- Files >200 LOC introduced: 0 (M-1 pre-existing)

## Recommended actions (priority order)

1. **[BLOCKER]** Ship `src/app/api/raas/missions/[id]/retry/route.ts` — H-2.
2. **[HIGH]** Replace F-1 inline query with `getUserTier(u.id)` — H-1. ~5-line patch.
3. **[MEDIUM]** Extract `toBcp47(locale)` helper — M-4. DRY across mission components.
4. **[MEDIUM]** Modularize `onboarding-tour-modal.tsx` (M-1). Pre-existing tech debt.
5. **[LOW]** Reconcile `defaultLocale` mismatch between i18n.ts and middleware.ts (E-4). Pre-existing.

## Score breakdown

- Correctness: 8/10 (H-2 retry endpoint missing; H-1 weaker tier semantics)
- Type safety: 10/10
- Security: 9/10 (F-2 properly delegates to server-side `requireAdmin`)
- Performance: 8/10 (F-1 N+1 acknowledged; OK at admin-list scale, but the simpler `getUserTier()` swap is free)
- i18n: 9.5/10 (parity + locale-aware dates)
- A11y: 9/10 (role="alert", aria-labels intact)
- Maintainability: 8/10 (LOC overflow on F-6 modal pre-existing; KEY_CONFIGS refactor solid)

**Composite: 8.6/10** — below the 9.0 target due to H-1 + H-2. Address both → 9.4.

## Unresolved questions

1. Should retry endpoint reuse the same PEV runner as the original mission, or trigger a fresh re-plan? (affects MCU billing semantics — does retry cost MCU again?)
2. F-6: should completion writes happen via Server Action (per Sophia rule) instead of `handleFinish()` API call? Out of scope for Wave 4.
3. Is the i18n.ts vs middleware.ts `defaultLocale` mismatch intentional? If `vi` is product default, middleware should match. Worth a separate ticket.
