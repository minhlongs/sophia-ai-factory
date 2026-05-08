# Cook Report — Dashboard Wave 1C (regression fix + form error UX)

**Date:** 2026-05-08 02:31 PT
**Trigger:** `/cook next` → re-scout fresh round 2 → 3 fixes (regression + UX + stub).

## Why this wave

Re-scout sau Wave 1B (commit `f992fa3d`) phát hiện 1 regression CRITICAL từ Wave 1A:
- `MasterWelcomeBanner` href `/dashboard/admin` → 404 (chỉ subpages tồn tại, no index).
- MASTER user dismiss banner mà không click cũng không thấy → bug invisible nhưng nghiêm trọng cho first-time UX.

Plus 2 form-flow gaps: proposals form không show server error, `/api/proposals` không exist.

## Changes (3 files modified + 1 new)

### F-A: Replace dead admin link → analytics
- `src/app/[locale]/dashboard/components/master-welcome-banner.tsx`: icon `LayoutDashboard` → `BarChart3`, key `'admin'` → `'analytics'`, href `/dashboard/admin` → `/dashboard/analytics`.
- `messages/en.json`: `feature.admin` "Admin Dashboard" → `feature.analytics` "Revenue Analytics".
- `messages/vi.json`: `feature.admin` "Bảng Quản Trị" → `feature.analytics` "Phân Tích Doanh Thu".

**Why analytics:** MASTER tier có quyền `canAccessRevenue` (rbac.ts:181-185), trong khi admin role là independent permission. Redirect tới `/dashboard/analytics` cho MASTER user là semantically chính xác — họ thấy revenue dashboard ngay, không phải admin tools.

### F-C: Surface server error trong proposals page
- `src/app/[locale]/dashboard/proposals/page.tsx`: thêm `errorMessage` state + red alert UI (`role="alert"`).
- Catch block extract error message từ `Error` instance hoặc fallback "Unknown error".
- `result.json().catch(() => ({}))` để defensive với non-JSON error body.

Trước: catch swallow → set score=0/passed=false → user không biết gì xảy ra.
Sau: catch surface error string lên UI → user thấy "Proposal generation is not available yet..." từ stub.

### F-S: Create /api/proposals stub
- `src/app/api/proposals/route.ts` (mới): POST handler, auth-gated qua `getCurrentUser()`, return 501 `{ error, code: 'PROPOSALS_NOT_IMPLEMENTED' }`.
- Replace silent 404 với structured error response. Form sẽ display rõ ràng tại sao không hoạt động.

## Verification

| Check | Result |
|---|---|
| `npx tsc --noEmit` | ✅ exit 0 |
| `npx vitest run` | ✅ 2796/2827 (baseline preserved) |
| `npm run build` | ✅ OpenNext 20s |
| i18n stale `feature.admin` refs | ✅ 0 |
| Broken `/dashboard/admin` link refs | ✅ 0 trong banner |
| code-reviewer | ✅ 9.7/10, 0 critical, APPROVE |

## Bundled F-B (affiliate-networks form feedback)

`affiliate-networks-client.tsx`:
- New `Notification` type + `notify()` helper với `useRef` cho timeout cleanup (no leak khi rapid notify).
- `readErrorBody()` helper extract server error JSON với defensive fallback.
- Wrap `fetchNetworks/handleSave/handleDelete/handleTest` trong try-catch + notify thành công/lỗi.
- Banner UI dynamic: `role="alert"` + `aria-live="assertive"` cho error, `role="status"` + `polite` cho success.
- Auto-dismiss sau 4s; cleanup timer khi component unmount.

## Bundled F-D (error boundaries top user-funnel routes)

5 file `error.tsx` mới dùng canonical template (giống `settings/error.tsx`) + i18n keys `errors.boundary.{title,message,retry,home}`:
- `redeem/error.tsx` (FREE100 redemption — high impact)
- `login/error.tsx`
- `welcome/[token]/error.tsx` (post-signup magic link)
- `checkout/failure/error.tsx`
- `payment-success/error.tsx`

Dashboard root + billing/wallet/account/byok đã có error.tsx → không cần thêm.

## Skip / Defer

| Item | Reason |
|---|---|
| Real /api/proposals implementation | Cần D1 schema (proposals table) + LLM generation pipeline — separate wave |
| 22 layer arch violations | Tech debt, không user-facing |
| 88 files >200 lines | YAGNI per Sophia rules |
| Proposals error heading i18n | Reviewer flagged non-blocking; defer Wave 1E nếu muốn full bilingual sweep |
| Extract `<RouteErrorFallback />` shared component | YAGNI — chỉ 5+ duplicates, threshold thông thường 7+ |

## Unresolved

- Khi nào ship full proposals API? Cần thiết kế D1 schema (proposals + versions + approval status?) trước.
- Có nên thêm `/dashboard/admin/page.tsx` index (cho admin users) hay đó là intentional design (admin chỉ access subpages)?
- F-B affiliate-networks form thiếu toast — defer Wave 1D hay accept current pattern?
- Wave 1B i18n keys `feature.admin` → `feature.analytics` rename — có user nào đã dismiss MasterWelcomeBanner trước Wave 1A? localStorage key `sophia.masterWelcomeDismissed` version `v1` không bump — nhưng vì label thay đổi materially, có nên bump `v2` để show lại cho existing users?
