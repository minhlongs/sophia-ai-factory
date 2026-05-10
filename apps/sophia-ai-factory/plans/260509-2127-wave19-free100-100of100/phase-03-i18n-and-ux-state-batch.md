# Phase 03 — i18n + UX State Batch (M4 + M5 + M6 + M9 + M10)

## Context Links

- Plan overview: `./plan.md`
- next-intl setup: `src/messages/en.json`, `src/messages/vi.json`
- Sophia handover rule: bilingual VI+EN mandatory per `apps/sophia-ai-factory/.claude/rules/sophia-handover-rules.md` (parent project rule)
- Audit findings M4–M10 from user prompt 2026-05-09

## Overview

- **Priority:** P1 (UX polish, not blocking but visible to FREE100 client)
- **Effort:** 1d
- **Status:** pending
- **Description:** Close every translation gap and missing UX state across video-generate form, distribute UI, channels client, and onboarding. Replace hardcoded English strings with `t(...)` keys present in BOTH locales. Wire missing toasts and error UI.

## Key Insights

- **M4** AiPromptForm reads keys `dashboard.videos.generate.promptLabel`, `styleLabel`, `styleCasual/Cinematic/Educational`, `languageLabel/En/Vi` — none of these exist in `en.json` or `vi.json`. Result: raw key strings render in production.
- **M5** `PublishingStatusBadges` hardcodes "Distribution Status" header + raw enum names ("queued", "live"). User sees English uppercased states.
- **M6** Distribute success toast key `successToast` exists in JSON but the click handler never calls `toast.success(...)` after the action returns.
- **M9** Onboarding `loadStepStatus` failure (catch at line 90) is logged but no user-facing message — page renders with all-three steps undone, user is confused.
- **M10** `channels-client` component shows hardcoded "Loading...", "Connected", "Are you sure you want to disconnect?" strings.

## Requirements

### Functional
- F1. Every `t('dashboard.videos.generate.*')` referenced in `AiPromptForm` MUST resolve in both locales.
- F2. `PublishingStatusBadges` MUST translate header + each status enum (queued, processing, live, failed, paused) via `t('dashboard.distribute.status.*')`.
- F3. After successful distribute action, a `t('dashboard.videos.distribute.successToast')` toast MUST fire.
- F4. Onboarding page error catch MUST render an inline `<Alert variant="warning">` translated banner with a Retry button.
- F5. Channels client MUST translate Loading / Connected / Disconnect-confirm strings.

### Non-Functional
- NF1. No new banned imports.
- NF2. Each touched component still <200 LOC after refactor; split if exceeded.
- NF3. JSON keys must be sorted/alphabetic within their parent namespace for diffability.
- NF4. Both `en.json` and `vi.json` MUST receive identical key sets — verified by a vitest snapshot or simple `compareKeys.test.ts`.

## Architecture

No new components. Edits to message files + 5 client components. Add a tiny vitest util (`messages-parity.test.ts`) that asserts identical key shape between `en.json` and `vi.json`.

```
src/messages/en.json          ← add missing keys for M4, M5, M9, M10
src/messages/vi.json          ← mirror EN keys with VI translations
src/messages/__tests__/messages-parity.test.ts  (NEW)

src/components/.../ai-prompt-form.tsx        ← M4 t() bindings
src/components/.../publishing-status-badges.tsx  ← M5 t() bindings
src/app/[locale]/dashboard/videos/[id]/distribute/* ← M6 toast wiring
src/app/[locale]/dashboard/onboarding/page.tsx OR components/onboarding-error.tsx ← M9
src/components/.../channels-client.tsx       ← M10 t() bindings
```

## Related Code Files

### Modify
- `/Users/macbook/projects/sophia-ai-factory/apps/sophia-ai-factory/src/messages/en.json`
- `/Users/macbook/projects/sophia-ai-factory/apps/sophia-ai-factory/src/messages/vi.json`
- AiPromptForm component (find via Glob `**/ai-prompt-form.tsx`)
- PublishingStatusBadges component (find via Glob `**/publishing-status-badges.tsx`)
- Distribute submit handler (find via Glob `**/[id]/distribute/page.tsx` and any client-side action wrapper)
- `/Users/macbook/projects/sophia-ai-factory/apps/sophia-ai-factory/src/app/[locale]/dashboard/onboarding/page.tsx` (M9 — render error alert)
- Channels client (find via Glob `**/channels-client.tsx`)

### Create
- `/Users/macbook/projects/sophia-ai-factory/apps/sophia-ai-factory/src/messages/__tests__/messages-parity.test.ts` (asserts key shape parity EN vs VI)
- `/Users/macbook/projects/sophia-ai-factory/apps/sophia-ai-factory/src/components/onboarding/step-status-error-alert.tsx` (small, re-usable, ~40 LOC) — only if inline alert is too noisy in page.tsx

### Delete
None.

## Implementation Steps

1. Run `grep -rn "t('dashboard.videos.generate" src/` to enumerate ALL keys actually called by AiPromptForm; catalogue them.
2. Add to `en.json` and `vi.json` under `dashboard.videos.generate.*`:
   - `promptLabel`, `promptPlaceholder`, `styleLabel`, `styleCasual`, `styleCinematic`, `styleEducational`, `languageLabel`, `languageEn`, `languageVi`, `submitButton`, `quotaExceeded`.
3. Add to messages under `dashboard.distribute.status.*`:
   - `header`, `queued`, `processing`, `live`, `failed`, `paused`.
4. Refactor `PublishingStatusBadges` to call `t(\`dashboard.distribute.status.\${row.status}\`)` (gracefully fall back to capitalize on unknown enum).
5. Add to messages under `dashboard.videos.distribute.successToast`, `errorToast`.
6. In distribute submit handler, after `await distributeAction(...)` resolves with `success: true`, call `toast.success(t('dashboard.videos.distribute.successToast'))`. On error → `toast.error(...)`.
7. Add to messages under `dashboard.onboarding.errorBanner.title`, `description`, `retryButton`.
8. Wire onboarding catch path: instead of silently logging, set a server-side `loadFailed` boolean and conditionally render `<StepStatusErrorAlert />` (or inline Alert) above the step list. Add a Retry button that re-fetches via `router.refresh()` (client island).
9. Add to messages under `dashboard.channels.client.*` for: `loading`, `connected`, `disconnect`, `confirmDisconnect`, `disconnecting`, `connectButton`.
10. Replace each hardcoded literal in channels-client with the corresponding `t(...)`.
11. Create `messages-parity.test.ts`:
    ```ts
    function flatten(obj: any, prefix = ''): string[] {
      return Object.entries(obj).flatMap(([k, v]) =>
        typeof v === 'object' && v !== null
          ? flatten(v, `${prefix}${k}.`)
          : [`${prefix}${k}`]
      );
    }
    expect(flatten(en).sort()).toEqual(flatten(vi).sort());
    ```
12. Run `npm run build` + `npm test`.
13. Manual verify: switch locale to `vi` on `/dashboard/videos/new` — no raw `dashboard.*` keys visible.

## Todo List

- [ ] Audit all `t(...)` calls across the 5 components (grep + tabulate)
- [ ] Add EN keys for M4 (video generate form)
- [ ] Add EN keys for M5 (distribute status badges)
- [ ] Add EN keys for M6 (distribute success/error toasts)
- [ ] Add EN keys for M9 (onboarding error banner)
- [ ] Add EN keys for M10 (channels client)
- [ ] Mirror all keys to VI with proper Vietnamese translation
- [ ] Refactor 5 components to consume keys
- [ ] Wire distribute success toast handler
- [ ] Wire onboarding error alert + Retry
- [ ] Add `messages-parity.test.ts`
- [ ] `npm run build` → 0 errors
- [ ] `npm test` → parity test green
- [ ] Code review pass
- [ ] Manual QA in both locales
- [ ] `npm run deploy:full` + SHA verify

## Success Criteria

- [ ] No raw `dashboard.videos.generate.*` keys visible on `/[locale]/dashboard/videos/new`.
- [ ] Status badge text translates between EN ("Live") and VI ("Đang phát") on `/dashboard/videos/[id]/distribute`.
- [ ] Distribute success → toast appears with translated copy.
- [ ] Onboarding D1 read failure → error alert shown with Retry button (test by mocking D1 down).
- [ ] Channels page shows "Đã kết nối" in VI / "Connected" in EN.
- [ ] Parity test enforces no drift on future PRs.

## Risk Assessment

| Risk | Probability | Impact | Mitigation |
|---|---|---|---|
| Vietnamese translations awkward / non-native | M | M | Use existing VI translations in adjacent keys for tone consistency; have CEO review post-deploy. |
| Toast lib not yet imported in distribute page | M | L | Confirm `sonner` (or current toast lib) is wired in shared `<Toaster/>` provider; reuse existing pattern. |
| Status badge already has fallback path that breaks when key map switched | M | M | Keep raw status as fallback in template literal: `t(\`...\${status}\`, { defaultValue: status })`. |
| Onboarding inline error alert duplicates an existing pattern | L | L | Search `**/error-alert*.tsx` first; reuse if found. |
| Parity test fails for *intentional* divergence elsewhere | L | L | Run flatten compare against current state first; baseline mismatches into `expect.toEqual` allowlist if pre-existing. |

## Security Considerations

- Toast/error copy MUST NOT leak internal error details (DB error messages). Translate to user-friendly fixed string; log raw error server-side only.
- Onboarding Retry button: `router.refresh()` only — does not re-trigger any mutating action.

## Next Steps

- Phase 04 (distribute polling) builds on M5 status badges — ensure Phase 03 lands first to avoid double-edit conflict on `publishing-status-badges.tsx`.
