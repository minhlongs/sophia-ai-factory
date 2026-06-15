# Frontend Go-Live Audit — Sophia AI Factory

**Date:** 2026-04-28 02:53
**Scope:** `apps/sophia-ai-factory/src/app/[locale]/dashboard/videos/**` + dashboard route boundaries
**Reviewer:** code-reviewer agent
**Stack:** Next.js 16 App Router, React 19, Tailwind 4, next-intl 4.8.2 (en+vi)

---

## Score Breakdown — Aggregate Frontend: 26/50

| Layer        | Score | Verdict                                                            |
| ------------ | ----- | ------------------------------------------------------------------ |
| i18n         | 1/10  | Catastrophic — videos has zero `useTranslations`; 35+ raw English  |
| a11y         | 5/10  | Button focus ring OK; gallery card has no role; raw `<img>`        |
| error-UX     | 6/10  | Parent dashboard/error.tsx covers child seg; videos has no loading |
| perf         | 5/10  | `<img>` instead of `next/image`; no lazy import; no `priority`     |
| responsive   | 9/10  | Tailwind grid + container scale; aside Button height 36px (mobile) |

---

## CRITICAL Gaps

### C-1. Zero i18n coverage in videos route — i18n /1
**Impact:** Vietnamese users see English everywhere; violates next-intl convention used in 28 other dashboard files.
**Files:** all 5 video files (no `useTranslations` import).
**Examples:**
- `videos/page.tsx:21` `>My Videos<` (h1)
- `videos/page.tsx:23` `>Generated videos from your Sophia campaigns<`
- `videos/page.tsx:30` `>New Video<`
- `videos/[id]/page.tsx:53` `← Back to gallery`
- `videos/[id]/page.tsx:56` `?? "Untitled"`
- `videos/components/video-gallery.tsx:51` `Loading videos...`
- `videos/components/video-gallery.tsx:62` `No videos yet. Create your first one.`
- `videos/components/video-gallery.tsx:99` `Rendering...` / `No preview`
- `videos/components/video-detail-client.tsx:71` `Could not reach render service. Refresh to retry.`
- `videos/components/video-detail-client.tsx:98` `Render failed`
- `videos/components/video-detail-client.tsx:109` `Rendering...`
- `videos/components/video-detail-client.tsx:118-133` `Status` `Duration` `HeyGen Job` `Created`
- `videos/components/video-detail-client.tsx:145` `Open in new tab` / `Download`
- `videos/new/page.tsx:14-17` `Create Video` + subtitle
- `videos/new/components/video-creator-wizard.tsx:81` step labels (`script`/`assets`/`render` capitalized)
- `videos/new/components/video-creator-wizard.tsx:105` `Back` / `Create Video`
- `videos/new/components/script-step.tsx:58-103` `Topic`/`Audience`/`Duration`/`Generate Script`/`Use This Script →`/`Hook`/`Body`/`CTA` + 2 placeholders
- `videos/new/components/asset-picker.tsx:43` `Loading avatars & voices...`
- `videos/new/components/asset-picker.tsx:49,74` `Choose Avatar` / `Choose Voice`
- `videos/new/components/render-status.tsx:45-71` `Initializing render...` / `Video ready` / `Render failed` / `Rendering...`

**Fix:** Add `dashboard.videos` namespace in `messages/en.json` and `messages/vi.json`. Wrap server pages with `getTranslations('dashboard.videos')` and client components with `useTranslations('dashboard.videos')`. Pattern reference: `dashboard/missions/page.tsx`.

### C-2. Error string in `dashboard/error.tsx` is Vietnamese-only — i18n
**File:** `dashboard/error.tsx:17,27,35,42,79,87`
**Impact:** EN locale users see 100% Vietnamese error messages.
**Fix:** Move to `dashboard.errors.{auth_expired,network,db,unknown}` keys; wrap with `useTranslations` (file already `"use client"`). Use `useLocale()` for redirect path: `(window.location.href = \`/${locale}/login\`)` — currently hardcoded `/login` bypasses locale prefix.

---

## HIGH Gaps

### H-1. Avatar/voice picker missing `aria-pressed` + focus ring — a11y
**File:** `videos/new/components/asset-picker.tsx:52-69, 77-86`
**Issue:** Toggle buttons (selected=primary border) need `aria-pressed={avatarId === a.avatar_id}` and explicit `focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none`. Raw `<button>` inherits no design-system focus styles.
**Fix:** Add `aria-pressed` + Tailwind `focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none`.

### H-2. `<img>` instead of `next/image` — perf + LCP
**Files:**
- `video-gallery.tsx:92` thumbnails (grid of 50)
- `asset-picker.tsx:60` avatar previews
**Impact:** No automatic AVIF/WebP, no lazy loading by default, layout shift risk, worse LCP. Cloudflare Workers OpenNext supports `next/image` with image optimization off — use `loading="lazy"` + explicit `width`/`height` minimum.
**Fix:** Either swap to `next/image` with `unoptimized` or add `loading="lazy" width={W} height={H}` to all `<img>`. `aspect-video` reserves slot but img itself still re-flows.

### H-3. No `error.tsx` / `loading.tsx` for videos segment — error-UX
**Issue:** `videos/`, `videos/new/`, `videos/[id]/` lack their own boundaries. Parent `dashboard/error.tsx` does catch, but it's hardcoded Vietnamese (see C-2) and shape doesn't match video flow (e.g. failed render in [id]).
**Fix:** Add `videos/error.tsx` (custom retry → reload gallery), `videos/[id]/not-found.tsx` (video missing → link back to gallery), `videos/loading.tsx` (skeleton matching grid).

### H-4. Touch targets <44px — touch
**Files:**
- `videos/page.tsx:28` "New Video" Link uses `px-4 py-2 text-sm` ≈ 32-36px h
- `video-detail-client.tsx:143-150` "Open in new tab" / "Download" anchors `px-4 py-2 text-sm`
- `video-creator-wizard.tsx:100,107` Button default size = `h-9` (36px)
- `script-step.tsx:101,106` same
**Fix:** Use `size="md"` (h-11=44px) for primary CTAs on mobile, OR add `min-h-[44px]` to Link anchors. WCAG 2.5.5 mandates 44×44.

### H-5. IDOR fix has no UX feedback for the "wrong owner" case — error-UX
**File:** `videos/[id]/page.tsx:43` `if (video.user_id !== user.id) notFound();`
**Issue:** Silently maps unauthorized to 404. Acceptable for security, but app-wide `not-found.tsx` should be checked. **Confirmed:** no `videos/[id]/not-found.tsx` — falls back to `app/not-found.tsx`. Verify message there is bilingual.

---

## MEDIUM Gaps

### M-1. Wizard step `<ol>` not keyboard-navigable; uses presentational text — a11y
**File:** `video-creator-wizard.tsx:75-84`
**Fix:** Add `aria-current="step"` on active `<li>`. Optional: render step name from i18n keys not `s.charAt(0).toUpperCase()` (which makes localization impossible).

### M-2. Form validation feedback is global, not field-adjacent — forms/a11y
**File:** `script-step.tsx:90` error rendered above buttons, not under specific input. Inputs lack `aria-invalid` / `aria-describedby`.
**Fix:** When `error` set, mark which field (or use generic ErrorAlert + `aria-live="polite"`).

### M-3. Disabled button doesn't have visible loading state on Click → Done flow — UX
**File:** `script-step.tsx:106-108` "Use This Script" doesn't disable while transitioning steps; rapid double-click may trigger duplicate `onDone(content)` re-render.
**Fix:** Add transition guard or `disabled={loading}`.

### M-4. `videoId` empty-string state encodes "not yet rendered" — type smell
**File:** `video-creator-wizard.tsx:38` `useState<string>("")` then check `step === "render" && videoId`. Stringly-typed truthiness; should be `useState<string | null>(null)`.

### M-5. No `prefers-reduced-motion` check on Loader2 animations — a11y
**Files:** all `Loader2 animate-spin` usages.
**Fix:** Add Tailwind `motion-reduce:animate-none` or CSS rule globally.

### M-6. Image without explicit `width`/`height` causes CLS — perf
**Files:** `video-gallery.tsx:92`, `asset-picker.tsx:60`
**Fix:** Even with `aspect-video` / `aspect-square` parent, declare intrinsic `width`/`height` to suppress layout jump.

---

## LOW Gaps

### L-1. `console.error` in `dashboard/error.tsx:60` — production code
Sophia rule: zero `console.log` in prod. Replace with structured logger or remove.

### L-2. `target="_blank"` without `rel="noopener noreferrer"` audit — present in detail
`video-detail-client.tsx:142` correct. No issue. (Self-check pass.)

### L-3. Hardcoded redirect `/login` skips locale prefix in 4 places
`videos/page.tsx:13`, `videos/[id]/page.tsx:29`, `videos/new/page.tsx:9`, `dashboard/error.tsx:75`
**Fix:** Use `redirect(\`/${locale}/login\`)` or `localizedHref(locale, "/login")`.

---

## Positive Observations

- `localizedHref` consistently used for in-app navigation (recent fix held).
- Wizard state lifted to parent — draft survives back/forward step.
- Polling error cap (`MAX_CONSECUTIVE_ERRORS = 5`) properly implemented in `video-detail-client.tsx:29,68-75`.
- `VideoDetailPage` IDOR check at `:43` is correct and not bypassable.
- `aria-label="Progress"` present on wizard step list.
- `role="alert"` on dashboard error (a11y win).
- Skeleton with `shimmer` prop in dashboard `loading.tsx` is well-shaped.

---

## Recommended Actions (priority order)

1. **C-1:** Add `dashboard.videos` namespace to en.json + vi.json; wrap all 9 video files. ~3h.
2. **C-2:** Localize `dashboard/error.tsx` strings; fix login redirect to use locale prefix. ~30m.
3. **H-1:** `aria-pressed` + focus ring on asset-picker buttons. ~10m.
4. **H-3:** Add `videos/error.tsx`, `videos/loading.tsx`, `videos/[id]/not-found.tsx`. ~30m.
5. **H-4:** Bump primary CTAs to `size="md"` on mobile or `min-h-[44px]`. ~15m.
6. **H-2:** `<img>` → `next/image` with width/height + lazy. ~30m.
7. **M-1..M-6, L-1..L-3:** batch in same PR. ~1h.

**Estimate to reach target 45/50:** ~6 hours, single-session.

---

## Metrics

- Files audited: 9 video files + 2 dashboard boundaries
- Hardcoded English strings (videos): **35+ occurrences**
- a11y violations (CRITICAL/HIGH): 5
- `<img>` (perf): 2 instances
- Missing route boundaries: 3 (error/loading/not-found in videos seg)
- Locale message keys missing: ~30 (videos namespace doesn't exist)

---

## Unresolved Questions

1. Is `next/image` safe on Cloudflare Workers OpenNext (image optimizer route)? — confirm with `apps/sophia-ai-factory/next.config.*` settings before swapping.
2. Should video status badge labels (`processing`/`completed`/`failed` at `video-gallery.tsx:107`) be enum-style or human-readable strings? Affects locale schema design.
3. Is there a brand guideline for primary CTA button height? Current `h-9` (36px) appears across many dashboard pages — fixing only videos creates inconsistency. Recommend project-wide bump or document exception.
4. `dashboard/error.tsx` was authored Vietnamese-only intentionally (Vietnamese-first product) — confirm with PM before adding English translations.
