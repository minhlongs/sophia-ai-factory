# Code Review — Surgical Sweep F-1..F-8 (Sophia AI Factory Dashboard)

**Date:** 2026-05-08 19:41
**Reviewer:** code-reviewer
**Scope:** 17 modified files + 2 messages files
**Verdict:** **8.4/10** — ship-ready with 2 latent runtime defects in F-2 publishers (must fix before any user activates Pinterest/LinkedIn channels in production; Zalo is OK)

---

## Summary by Fix

| ID | Status | Notes |
|---|---|---|
| F-1 redirect `/auth/login` → `/login` | ✅ Clean | All 13 dashboard pages consistent. middleware honors next-intl `localePrefix:'as-needed'`; redirects pass through intl handling. No remaining `/auth/login` page redirects. |
| F-2 publish-execute pinterest/linkedin/zalo | 🔴 **2 latent bugs** | See CRITICAL-1 + CRITICAL-2 below. |
| F-3 proposals beta badge + notice | ✅ Clean | `role="status"` correct for non-urgent advisory. i18n keys parity OK. |
| F-4 credits page i18n sweep | ✅ Clean | `t` + `tBanner` split is necessary (next-intl scoped to one namespace). Parallel fetch keeps it efficient. Naming unambiguous. |
| F-5 video wizard MISSING_KEY | ✅ Clean | API at `/api/heygen/create-video` returns `{ code:"MISSING_KEY" }` on 503; wizard switch correct. |
| F-6 proposals i18n keys | ✅ Clean | en/vi parity on `errors.{generic,unknown}` + `beta_badge` + `beta_notice`. |
| F-7 INVITE_NOT_IMPLEMENTED 501 | 🟡 Inert | `code` field added but no caller consumes it (`AdminInviteResponse` interface only types `success/message/userId`). Not harmful — future-proofing. |
| F-8 deleted stale TODO | ✅ Verified | Function `urlRevenueVideoHandler` is registered at `src/app/api/inngest/route.ts:19,44`. |

---

## CRITICAL Findings

### CRITICAL-1: Pinterest publisher will fail at Pin creation
**File:** `src/forest/inngest/functions/publish-execute.ts:70`
**Code:** `new PinterestPublisher(accessToken, channel.external_account_id)`

`PinterestPublisher` constructor's 2nd arg is documented as `boardId` (target board for the Pin) and is sent as `board_id` in the Pinterest API call (`pinterest-publisher.ts:98`).

But `external_account_id` stores `meData.id` from `/v5/user_account` callback (`src/app/api/oauth/pinterest/callback/route.ts:148,169`) — that is the **Pinterest user ID**, not a board ID. Passing user ID to `board_id` will return 4xx from Pinterest API.

**Fix suggestion (one of):**
- Add a `default_board_id` column to `publishing_channels` (set during onboarding via Pinterest list-boards UI), and pass it instead of `external_account_id`
- Short-term: at publish time, call `GET /v5/boards?page_size=1` with the channel's accessToken and use first board ID; fail with friendly error if user has no boards

### CRITICAL-2: LinkedIn post will fail with 422 on author URN
**File:** `src/forest/inngest/functions/publish-execute.ts:72`
**Code:** `new LinkedInPublisher(accessToken, channel.external_account_id)`

`LinkedInPublisher.authorUrn` is sent as `author` in `/v2/posts` body (`linkedin-publisher.ts:134`) and as `owner` in upload registration (`:82`). LinkedIn API requires URN format like `urn:li:person:abc123`.

But `external_account_id` stores `profile.id` (bare ID `"abc123"`) from `/v2/me` callback (`src/app/api/oauth/linkedin/callback/route.ts:150,171`). LinkedIn `/v2/posts` will reject bare IDs with 422.

**Fix suggestion (preferred):** wrap at construction site:
```ts
case 'linkedin':
  return new LinkedInPublisher(
    accessToken,
    `urn:li:person:${channel.external_account_id}`,
  );
```
Alternatively, normalize at OAuth callback (store the URN form in `external_account_id`) — but that requires migration.

---

## HIGH

### HIGH-1: No tests for the 3 new `buildPublisher` cases
**File:** `src/forest/inngest/functions/publish-execute.ts:66-73`
The two latent bugs above (CRITICAL-1, CRITICAL-2) would have been caught by even a minimal unit test asserting "linkedin author is URN-shaped". The existing `publish-execute-cas.test.ts` only covers the CAS update pattern, not provider routing. The 2 instagram/facebook tests at `src/lib/publishing/__tests__/` cover publishers in isolation, not the buildPublisher dispatch.

**Fix suggestion:** add `publish-execute-build-publisher.test.ts` with one assertion per case (instantiation + key construction args).

---

## MEDIUM

### MED-1: publish-execute.ts at 326 LOC (over 200 LOC threshold)
**File:** `src/forest/inngest/functions/publish-execute.ts`
Pre-existing condition; the F-2 sweep added 6 lines but did not modularize. Per `development-rules.md` ≤200 LOC.

**Fix suggestion:** extract `buildPublisher` + `buildPostUrl` to `src/lib/publishing/publisher-factory.ts`, drop the publish-execute.ts file ~60-80 lines.

### MED-2: F-7 `code` field is inert
**File:** `src/app/api/admin/invite/route.ts:65`
The new `code: "INVITE_NOT_IMPLEMENTED"` field is not consumed anywhere — `AdminInviteResponse` interface (`src/app/[locale]/(admin)/admin/users/admin-users-client.tsx:6-10`) only types `{success,message,userId}`. The friendly message renders fine via `data.message` in the catch path, so user impact is correct, but `code` is dead until UI is updated to switch on it.

**Fix suggestion:** either (a) remove `code` to keep response surface honest, or (b) add `code?: string` to `AdminInviteResponse` and switch on `INVITE_NOT_IMPLEMENTED` to render a richer admin UI banner.

### MED-3: i18n `missionPrefix` not localized in vi.json
**File:** `messages/vi.json` `dashboard.credits.missionPrefix = "Mission"`
Stayed as English. Cosmetic — original was hardcoded "Mission" too, so no regression. Vietnamese could be "Nhiệm vụ" or just keep "Mission" if branded.

### MED-4: F-3 beta_notice — accessibility nit
**File:** `src/app/[locale]/dashboard/proposals/page.tsx:99-102`
`role="status"` on a banner that does NOT update dynamically post-render is acceptable but conventionally `role="note"` or no role is preferred for static advisories. `status` implies live-region updates, which screen readers will announce on first render. Minor.

---

## LOW

### LOW-1: F-4 `tBanner` could be `tLow` for clarity
The variable name `tBanner` works but `tLowBanner` (matching namespace `credits_low_banner`) would aid readability when scanning for translator origin. Skip if too churny.

### LOW-2: F-5 wizard error key namespace mismatch with errors.title (page-level vs wizard-level)
The `dashboard.videos.errors.{title,description,retry}` keys are page-level (used by `videos/error.tsx`); `unknown` + `missing_heygen_key` are wizard-level. They share a namespace which works but mixes concerns. Acceptable for now.

---

## Edge Cases Reviewed

| Concern | Result |
|---|---|
| `redirect('/login')` under `[locale]` route segment | ✅ Next.js handles — middleware re-adds locale prefix as needed |
| `useTranslations('dashboard.videos').t('errors.missing_heygen_key')` resolves | ✅ Both en/vi have key |
| Proposals `errors.unknown` fallback chain | ✅ `err instanceof Error ? err.message : t('errors.unknown')` covers all paths |
| `tBanner` ↔ `t` accidental cross-call | ✅ `tBanner` only used at lines 69,76 (low banner block); `t` only outside |
| en/vi key count parity | ✅ proposals +5, videos.errors +2, credits +11 — equal both files |
| F-2 Zalo arity (single accessToken) | ✅ Constructor matches |
| F-7 caller behavior | ✅ Falls through to `data.message` rendering (client doesn't switch on `code`) |
| F-8 inngest registration actually live | ✅ Verified at `src/app/api/inngest/route.ts:19,44` |

---

## Positive Observations

- F-1: Mechanical sweep is exhaustive. `grep '/auth/login'` over `src/app/[locale]/` returns 0.
- F-3: `role="alert"` on error banner + `role="status"` on beta notice is the correct contrast.
- F-4: Parallel `Promise.all` for `[balance, transactions, t, tBanner]` keeps perf.
- F-5: Switching on machine-readable `code` (not error string) is the right pattern.
- F-7: Workaround field with step1/step2 is operator-friendly.
- F-8: TODO removal followed by verifying the registration actually happened — clean.

---

## Recommended Actions

1. **BEFORE PRODUCTION ENABLE Pinterest/LinkedIn:** Fix CRITICAL-1 and CRITICAL-2. Zalo is safe to ship.
2. Add `publish-execute-build-publisher.test.ts` covering all 7 provider cases.
3. Decide on F-7 `code` field: drop or wire up.
4. (Backlog) Extract `buildPublisher`/`buildPostUrl` to a factory module to bring publish-execute.ts under 200 LOC.

---

## Metrics

- Type Coverage: ✅ no new `:any`
- Test Coverage: 2810/2810 passing per task context. New buildPublisher cases UNTESTED (HIGH-1).
- Linting: presumed clean (per task context tsc 0 errors)
- LOC compliance: 4/5 modified files ≤200 LOC; publish-execute.ts is 326 LOC (pre-existing)

---

## Unresolved Questions

1. Are Pinterest/LinkedIn channels actually enabled for any production user yet? If F-2 paths are dormant pending OAuth UI, CRITICAL-1/2 can land same release as the activation. If users can already attempt to publish, hot-fix needed.
2. Should `external_account_id` semantics be normalized at write time (OAuth callback) so the column always stores the URN/board-ready form? Cleaner but requires a migration + backfill if any existing rows exist.
3. Confirmation request: F-7 should the `code` field stay (future-proof) or be dropped (YAGNI)?
