# Sophia RaaS GAP Scout — Round 6

**Branch:** main @ 8cb31b49 (post Wave 3)
**Date:** 2026-05-08 20:43
**Scope:** un-scouted dashboard surfaces (missions, analytics, settings, support, admin/users, sitemap, onboarding tour, mission-detail, terminal demo, transactional emails)

---

## State of the Dashboard (one paragraph)

After Waves 1B–3, marketing pages + most user dashboard surfaces are bilingual, locale-aware, and the core CTA path (pricing → checkout → /dashboard) deploys clean. Remaining un-shipped P0/P1 GAPs concentrate in three pockets: (1) `/dashboard/settings` — entire form (Profile/Appearance/ApiKeys/Notifications, ~4 sections) is hardcoded English with stray Vietnamese strings, breaking bilingual contract for first-time MASTER user; (2) `admin/users` page is functionally broken — every user displays `tier: "BASIC"` (hardcoded line 33) and the invite modal uses `prompt()` for HTTP Basic Auth (line 47), making admin tier promotion impossible; (3) Mission Detail UI lacks retry CTA on `failed` state and Agent Team Panel "Create team" link points to `/dashboard/settings` (no team/agent management exists there — dead link). Plus locale gets stripped on `/dashboard/*` 308 redirects, AdminInvite uses Basic Auth via `prompt()` (UX disaster), and onboarding-tour `handleActionNav` uses `window.location.href` which loses locale prefix. `/api/admin/users` doesn't exist; mission control wiring is solid otherwise; emails ARE bilingual (good); sitemap excludes `/blog` slug pages; production HTTP green.

---

## TOP 8 GAPs

### F-1 — `[P0]` Admin Users page hardcodes tier="BASIC" for ALL users
- **Location:** `src/app/[locale]/(admin)/admin/users/page.tsx:33`
- **Evidence:** `tier: "BASIC"` literal in the `.map()` — DB query selects only `id, email, role, created_at, last_sign_in_at` (no tier). Page is admin's primary user-management UI. Tier promotion impossible.
- **Fix:** JOIN/SELECT `subscriptions.tier` (or D1 `tier_grants`) per-user; map actual tier into `AdminUserRow.tier`.
- **Effort:** S

### F-2 — `[P0]` Admin invite modal uses `prompt()` for Basic Auth
- **Location:** `src/app/[locale]/(admin)/admin/users/admin-users-client.tsx:46-48`
- **Evidence:** `Authorization: "Basic " + btoa(\`${prompt("Admin user")||""}:${prompt("Admin password")||""}\`)` — two synchronous browser prompts every invite. Awful UX, security smell.
- **Fix:** Use existing session cookie + admin-role check; remove Basic Auth + prompts; rely on `/api/admin/invite` route's `getCurrentUser()` admin check.
- **Effort:** S

### F-3 — `[P0]` Settings page entirely English; mixed VI strings in api-keys-section
- **Location:** `src/forest/components/settings/{settings-form,sections/profile-section,sections/appearance-section,sections/notifications-section,sections/api-keys-section}.tsx`
- **Evidence:** All 4 sections contain literal English strings (`"Profile"`, `"Appearance"`, `"Theme Preference"`, `"Marketing Emails"`, `"Save Changes"`); `api-keys-section.tsx:37,40` mixes Vietnamese (`'Trí tuệ nhân tạo cho nội dung văn bản'`, `'Lấy key tại OpenRouter'`) inline. Settings i18n key tree exists at `messages/en.json:1302` but unused.
- **Fix:** Wire `useTranslations('settings')` in each section; populate `messages/vi.json` settings tree; remove hardcoded VI strings from KEY_CONFIGS.
- **Effort:** M

### F-4 — `[P1]` Mission Detail no retry CTA on `failed` state
- **Location:** `src/forest/components/raas/mission-detail.tsx:79-83`
- **Evidence:** Failed status shows only `<error icon> + t('mission_failed')` — no retry button, no error reason, no contact-support link. User stuck.
- **Fix:** Add retry button (POST `/api/raas/missions/{id}/retry`) + error reason field + support mailto/tg fallback when `mission.status === 'failed'`.
- **Effort:** S

### F-5 — `[P1]` AgentTeamPanel "Create team" CTA → dead link to `/dashboard/settings`
- **Location:** `src/forest/components/missions/agent-team-panel.tsx:73`
- **Evidence:** `onClick={() => { window.location.href = '/dashboard/settings'; }}` — settings page has no agent/team management UI. User reaches dead-end.
- **Fix:** Either route to a real agent-create page (e.g. `/dashboard/agents/new`) or replace CTA with mailto/docs link until feature exists. Also `window.location.href` loses locale.
- **Effort:** XS

### F-6 — `[P1]` Onboarding tour `handleActionNav` strips locale
- **Location:** `src/app/[locale]/dashboard/components/onboarding-tour-modal.tsx:113-117`
- **Evidence:** `window.location.href = href` where href is plain `/dashboard/byok`, `/dashboard/sop-marketplace`, etc. — bypasses Next router → drops `/en/` or `/vi/` prefix; full reload.
- **Fix:** Replace `window.location.href` with `router.push()` so locale prefix preserved (and SPA-nav).
- **Effort:** XS

### F-7 — `[P1]` Mission list `toLocaleString()` no locale param
- **Location:** `src/forest/components/raas/mission-dashboard.tsx:99` (and similar in `mission-detail.tsx:72`)
- **Evidence:** `new Date(m.created_at).toLocaleString()` — uses browser default locale, ignores active i18n locale. VI users see EN dates, EN users see machine locale.
- **Fix:** Pass `locale === 'vi' ? 'vi-VN' : 'en-US'` from `useLocale()` hook to `toLocaleString(locale, opts)`.
- **Effort:** XS

### F-8 — `[P2]` Sitemap excludes blog post slugs and bundle SKUs
- **Location:** `src/app/sitemap.ts:20-41`
- **Evidence:** `staticPages` array has `/blog` only (no per-post slugs). No SKU/product pages. Both bilingual variants emit only the `/blog` index, hurting blog discovery.
- **Fix:** Async-fetch published blog post slugs from D1 (or content provider) and include in sitemap; same for Premium one-time bundle product pages if they exist.
- **Effort:** S

---

## Bonus GAPs (deferred, P2/polish)

- `[P2]` Privacy + Terms pages hardcoded English (`src/app/[locale]/privacy/page.tsx:14-66`) — page imports `getTranslations('privacy')` but never uses it; all sections literal English.
- `[P2]` Support page tier list hardcoded (`SUPPORT_TIERS` array in support/page.tsx:14-47) — `responseTime` strings (`"48h"`, `"Instant"`) + channel labels (`"Direct Founder Access"`, `"VIP Forever"`) not in i18n; bilingual MASTER sees mixed lang.
- `[P2]` `/dashboard/missions` 308 redirects strip `/en/`+`/vi/` prefix → middleware sees raw `/dashboard/...` then re-redirects to `/login` (no locale). Consistent with other W3-fixed flows but missions wasn't covered.

---

## Verification (production)

- `curl -sI https://sophia.agencyos.network/sitemap.xml` → HTTP/2 200 ✅
- `curl https://sophia.agencyos.network/en/dashboard/missions -L -w '%{url_effective}'` → resolves to `/login` (locale dropped) ⚠️
- `curl -sI https://sophia.agencyos.network/api/agents/list` → HTTP/2 401 ✅ (auth-gated as expected)

---

## Already shipped — confirmed NOT re-flagged

Wave 1B–D, Phase 1, Wave 2, Wave 3, Phase-2 backlog items per scout brief.

## Ranking summary

P0: F-1, F-2, F-3 — block admin tier ops + bilingual contract
P1: F-4, F-5, F-6, F-7 — bad UX on user journey
P2: F-8 — SEO polish

---

## Unresolved questions

1. Is there an Agents-mgmt page planned (referenced by F-5 dead link), or should "Create team" CTA be removed entirely until backend exists?
2. Should `/api/admin/users` be created with PATCH for tier change, or reuse `/api/admin/licenses/[id]/extend` pattern?
3. Mission retry semantics — same MCU cost re-deducted, or refunded then retried?
4. Should sitemap blog slugs be statically generated at build time (D1 query in `sitemap.ts`) or proxied via revalidate-on-demand?
