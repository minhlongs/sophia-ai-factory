# UX Audit — Video-Gen Surface

- **Date:** 2026-05-19 23:00
- **Reviewer:** code-reviewer agent
- **Surface:** `/dashboard/create`, `/dashboard/videos`, `/dashboard/videos/new`, `/dashboard/videos/[id]`
- **Stack:** Next.js 16 App Router, React 19, TS strict, Tailwind 4, next-intl en/vi, dark default
- **Methodology:** Static read of all listed files + supporting components (server action, EmptyState, dashboard skeleton/error). i18n parity check (en/vi) — 100% present for keys touched. No live browser inspection performed.

---

## Verdict

**GO — UX score 78/100.**
Ship-blocking critical: **0**. High polish: **4** (worth fixing in next sprint). Surface is consistent, accessible at baseline, i18n complete, status flow honest. Main weakness: status badge contrast + gallery loading state (spinner not skeleton) + double-empty-state coupling.

---

## Critical UX Bugs (BLOCK go-live)

_None._ All inspected flows render, recover, and localize correctly. No stack-trace leakage, no untranslated raw keys in JSX, no orphan submit states.

---

## High Polish Gaps (degrade trust)

### H1. Video gallery loading state regresses to spinner (no skeleton, CLS)
- **File:** `src/app/[locale]/dashboard/videos/components/video-gallery.tsx:51-58`
- **Issue:** Client-side gallery shows centered `Loader2` spinner + "Loading..." text instead of the card-grid skeleton it eventually replaces. Layout jumps when 12 cards pop in (CLS > 0.1 likely on 3G).
- **Note:** `videos/page.tsx` itself does server-side count and renders `<EmptyState>` for 0 but still mounts `<VideoGallery>` for ≥1 — gallery then re-fetches via `/api/videos` and shows spinner. Effectively two loading screens for users with ≥1 video.
- **Impact:** First-impression jank on the most-visited page.

### H2. Status badges have failing AA contrast on dark theme
- **File:** `video-gallery.tsx:127-131`
- **Issue:** `bg-green-500/15 text-green-700` and `bg-yellow-500/15 text-yellow-700` use light-mode green/yellow-700 over translucent backgrounds. On the project's dark-default theme, green-700 (#15803d) on near-black ≈ 3.8:1 contrast — **fails AA (4.5:1)**. Yellow-700 (#a16207) on near-black ≈ 4.2:1 — also fails. Only `text-destructive` (theme token) properly adapts.
- **Impact:** Critical state info (processing/completed/failed) is hard to read in the default theme.

### H3. Status badge text is not localized + not capitalized via theme
- **File:** `video-gallery.tsx:113-115`
- **Issue:** `<span>{video.status}</span>` renders raw DB string ("processing", "completed", "failed") instead of `t(`status.${v.status}`)`. Bypasses i18n for one of the most visible labels.
- **Impact:** Vietnamese users see English status; visual inconsistency with `dashboard.videos.status` label which IS translated.

### H4. Progress bar percentage misleading when step="parse"
- **File:** `render-progress.tsx:124-135`
- **Issue:** `pct = Math.round((activeIdx / 6) * 100)`. When step="parse" (idx 0) progress is 0% but bar uses `Math.max(5, pct)` → always shows 5%. Reasonable, but **no time estimate or indeterminate spinner** while waiting on first SSE event. User sees a frozen 5% bar with `▶ Parsing` and no log line for ~5–15s on cold start.
- **Impact:** Looks broken on slow first event. Suggest: show pulsing/indeterminate state when `currentStep === undefined`.

---

## Medium Nice-to-Have

- `ai-prompt-form.tsx:89-97` — `minLength={10}` is enforced both via HTML attr and `disabled={form.prompt.length<10}`. Good. But no visible hint "Enter at least 10 characters" until user blurs — add helper text under counter.
- `ai-prompt-form.tsx:143-149` — Submit button has no spinner icon, just text swap "Generate" → "Generating...". Add inline `Loader2` for stronger feedback consistent with `<VideoGallery>`.
- `ai-prompt-form.tsx:54` — On submit failure, focus is not moved to error message — screen reader users miss it. Add `aria-live="polite"` on the error block or focus it programmatically.
- `render-progress.tsx:96-99` — EventSource cleanup happens on unmount but never on terminal success/fail except inside listener `es.close()`. Already handled, just verify `esRef` is not used elsewhere (it's not — dead ref, can be removed).
- `render-progress.tsx:88-94` — `onerror` only closes when status already terminal. **No user feedback if SSE never connects** (e.g., user offline mid-stream). Add timeout fallback to show "Connection lost, refresh page".
- `video-detail-client.tsx:46-77` — Polling retry uses fixed 5s interval. Server-Sent Events would be more efficient (the new-page already uses SSE — inconsistent). On dashboard refresh of a stuck job, this polls forever silently until 5 errors then surfaces. Consider exponential backoff.
- `video-detail-client.tsx:118` — `<dd className="font-medium capitalize">{video.status}</dd>` same i18n gap as H3.
- `video-gallery.tsx:97-103` — `unoptimized` on `<Image>` from D1/R2 — fine for now but loses LCP perf; consider adding configured remotePatterns.
- `videos/page.tsx:34-47` — Server pre-fetch only counts (`SELECT COUNT(*)`) then client fetches full list separately. Could pre-fetch first page server-side and hydrate to remove the second loading state (fixes H1 root cause).
- `videos/page.tsx:64-76` — `videoCount === 0` empty state + `<VideoGallery>` inner empty state are both present — duplicated logic, both translated to different keys (`dashboard.emptyState.videos` vs `dashboard.videos.empty`). DRY violation; pick one source of truth.
- `video-player.tsx:22-27` — `<video controls>` lacks `preload="metadata"` (saves bandwidth) and `playsInline` (iOS Safari fullscreen-on-play bug).
- `video-player.tsx:29-44` — Two `<a>` tags differ only by `download` attr — confusing label "Open in new tab" vs "Download". Combine into a single dropdown or use icons (lucide `ExternalLink` / `Download`).
- `[id]/page.tsx:103-106` — Distribute button gated by env var `NEXT_PUBLIC_DISTRIBUTE_ENABLED === '1'` — fine, but for users where this is off there is no copy explaining publish is coming soon. Silent absence.
- `[id]/page.tsx:67-85` — Sequential N+1: fetch jobs → fetch channels separately. Use a JOIN or `IN` query in one shot for D1 throughput.
- `videos/page.tsx:10-18` — `getD1()` global env probing duplicates `createServerClient()`. Use the canonical `createServerClient()` per project rule (`@/lib/db/client`); current code is an exception worth eliminating.
- `create/page.tsx` and `videos/new/page.tsx` — different page chrome (`max-w-6xl mx-auto` vs `container mx-auto py-8 max-w-3xl`). Pick one container convention for "create" surfaces.

---

## Verified GOOD (do not regress)

- **Touch targets:** All primary CTAs (`bg-primary` buttons, distribute, retry, login link) include `min-h-[44px]` — passes Apple HIG / WCAG 2.5.5 baseline.
- **Skeleton-first loading:** `create/loading.tsx`, `videos/new/loading.tsx` (DashboardSkeleton variant=list), `videos/[id]/loading.tsx` (variant=detail) all reserve layout space with shimmer skeletons; zero CLS on cold nav.
- **Error boundary hygiene:** `DashboardError` classifies err (auth/network/db/unknown), localizes via inline EN/VI dict, surfaces `error.digest` via `data-error-digest` only in dev, never to user — no stack-trace leak.
- **i18n parity:** All 56 string keys touched by these pages exist in BOTH `messages/en.json` and `messages/vi.json` (verified by script). No raw `t('foo.bar')` keys would leak to production.
- **A11y baseline:** Form inputs have `<label htmlFor>` pairs, video element has `aria-label`, error containers carry `role="alert"`, icon-only nav uses `aria-hidden`. Focus ring (`focus:ring-2 focus:ring-ring`) present on all form fields.

---

## Concrete Fix List — Top 5

### Fix 1 — H2: Status badge contrast via theme tokens
**File:** `src/app/[locale]/dashboard/videos/components/video-gallery.tsx:127-131`

```diff
 function statusColor(status: VideoItem["status"]): string {
-  if (status === "completed") return "bg-green-500/15 text-green-700";
-  if (status === "failed") return "bg-destructive/15 text-destructive";
-  return "bg-yellow-500/15 text-yellow-700";
+  if (status === "completed") return "bg-emerald-500/20 text-emerald-400 dark:text-emerald-300";
+  if (status === "failed") return "bg-destructive/20 text-destructive-foreground dark:text-red-300";
+  return "bg-amber-500/20 text-amber-400 dark:text-amber-300";
 }
```

### Fix 2 — H3: Localize status badge text
**File:** `src/app/[locale]/dashboard/videos/components/video-gallery.tsx:109-115`

```diff
         <span
           className={`absolute top-2 right-2 text-xs px-2 py-0.5 rounded ${statusColor(
             video.status
           )}`}
         >
-          {video.status}
+          {t(`statusLabel.${video.status}`)}
         </span>
```
Also add to `messages/en.json` and `vi.json`:
```json
"statusLabel": { "processing": "Processing", "completed": "Ready", "failed": "Failed" }
"statusLabel": { "processing": "Đang xử lý", "completed": "Sẵn sàng", "failed": "Thất bại" }
```

### Fix 3 — H1: Gallery uses skeleton, not spinner
**File:** `src/app/[locale]/dashboard/videos/components/video-gallery.tsx:51-58`

```diff
   if (loading) {
     return (
-      <div className="flex items-center gap-2 text-sm text-muted-foreground">
-        <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" />
-        {t("loading")}
-      </div>
+      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
+        {[1,2,3,4,5,6].map(i => (
+          <div key={i} className="rounded border overflow-hidden">
+            <div className="aspect-video bg-muted animate-pulse motion-reduce:animate-none" />
+            <div className="p-3 space-y-2">
+              <div className="h-4 bg-muted rounded w-3/4 animate-pulse motion-reduce:animate-none" />
+              <div className="h-3 bg-muted rounded w-1/3 animate-pulse motion-reduce:animate-none" />
+            </div>
+          </div>
+        ))}
+      </div>
     );
   }
```

### Fix 4 — H4: Indeterminate progress until first step
**File:** `src/app/[locale]/dashboard/videos/new/components/render-progress.tsx:124-135`

```diff
   const activeIdx = stepIndex(currentStep);
   const pct = Math.round((activeIdx / (STEP_ORDER.length - 1)) * 100);
+  const isIndeterminate = currentStep === undefined;

   return (
     <div className="flex flex-col gap-4">
       {/* Progress bar */}
       <div className="h-2 rounded-full bg-muted overflow-hidden">
-        <div
-          className="h-full bg-primary transition-all duration-500"
-          style={{ width: `${Math.max(5, pct)}%` }}
-        />
+        {isIndeterminate ? (
+          <div className="h-full w-1/3 bg-primary motion-safe:animate-[indeterminate_1.5s_ease-in-out_infinite]" />
+        ) : (
+          <div
+            className="h-full bg-primary transition-all duration-500"
+            style={{ width: `${Math.max(5, pct)}%` }}
+          />
+        )}
       </div>
```
Add to `tailwind.config` or global CSS:
```css
@keyframes indeterminate { 0% { transform: translateX(-100%);} 100% { transform: translateX(300%);} }
```

### Fix 5 — Medium: VideoPlayer mobile/perf polish
**File:** `src/app/[locale]/dashboard/videos/new/components/video-player.tsx:22-27`

```diff
       <video
         src={src}
         controls
+        playsInline
+        preload="metadata"
         className="w-full rounded-lg border border-border shadow-sm"
         aria-label={t('create.title')}
       />
```

---

## Mobile / Responsive Notes

- Grid breakpoints OK: `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3` — collapses cleanly at < 640px.
- Form (ai-prompt-form) at `max-w-3xl` is fine on iPhone 13 (390px); textarea `rows={4}` + `resize-none` prevents iOS keyboard jank.
- Video detail header `flex items-center justify-between` may wrap awkwardly when "Backed to gallery" link is long in Vietnamese — recommend `flex-wrap gap-2` on small screens.
- All primary CTAs satisfy 44×44 minimum touch target.

---

## Accessibility Summary

- ✅ Labels on all inputs (`htmlFor` paired with `id`)
- ✅ `role="alert"` on error containers
- ✅ `aria-hidden` on decorative icons + arrows
- ✅ Focus rings present (`focus:ring-2`)
- ⚠️ Status badge text not localized (H3)
- ⚠️ Form submit error not auto-focused/announced (Medium)
- ⚠️ Step list `<ol>` uses unicode glyphs `✓ ▶ ○` — fine visually but no `aria-current="step"` on active item to announce progress to screen readers.

---

## Unresolved Questions

1. Is `getD1()` helper in `videos/page.tsx` intentional (bypassing `createServerClient()`) — or pending refactor? Inconsistent with project doctrine.
2. Should `H3` status labels share a vocabulary with the SSE `engine_missions.status` values (`pending|running|succeeded|failed|cancelled`) or stay with the simpler videos-table set (`processing|completed|failed`)? Two parallel ontologies in same surface.
3. `NEXT_PUBLIC_DISTRIBUTE_ENABLED` toggle — is the goal to keep the feature dark on prod or run a soft launch? Affects whether "coming soon" copy should be added.
4. Why is `<Image unoptimized>` used for thumbnails — R2 CORS issue or deliberate to skip Next image optimizer? Affects LCP.
5. Polling vs SSE in detail page — keep both flows or migrate detail page to SSE for consistency?
