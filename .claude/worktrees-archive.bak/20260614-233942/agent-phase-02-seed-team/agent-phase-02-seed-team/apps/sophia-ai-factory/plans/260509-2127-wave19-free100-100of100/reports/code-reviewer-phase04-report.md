# Code Review — Wave 19 Phase 04 (Distribute Polling)

**Verdict: APPROVED — 9.2/10**
**Security verdict: PASS** (with one minor caveat below).

## Critical findings (🔴) — none blocking

1. **Cross-user filter (PASS).** `route.ts:67-74` does an explicit `videos.user_id` ownership check returning 404 before fetching jobs. Subsequent UNION further filters by `pc.user_id = ?` (OAuth) and `pj.tenant_id = ?` (Telegram, where `tenant_id == user.id`). Cross-user video request → 404. ✅
2. **D1 contract (PASS).** Uses `.first<T>()` and `.all<T>()` correctly. Reads `results` from `.all()`. No fictional `.error` on `.run()`. ✅
3. **last_error sanitization (PASS).** Catches `Bearer .*` and `token=...`, then `slice(0, 200)`. Test Case 5 verifies. Note: order of operations means redacted-then-truncated, so a 400-char error with token at byte 250 would lose REDACTED marker — acceptable trade-off but consider truncate-then-redact for completeness.
4. **AbortController (PASS).** Hook aborts in cleanup AND on every new fetch (line 52). Race-free on `videoId` change because effect cleanup runs before re-mount with new id.
5. **Visibility pause (PASS).** Uses `document.visibilityState === 'hidden'` and `'visible'` correctly. Resume triggers immediate `tick()`.
6. **Cache headers (PASS).** `Cache-Control: no-store`, `CDN-Cache-Control: no-store`, `Vary: Authorization` all present. ✅
7. **Zod UUID validation (PASS).** Test Case 4 confirms 400 on non-UUID.
8. **UNION leakage (PASS).** OAuth branch keyed on `pc.user_id`; Telegram branch keyed on `pj.provider='telegram' AND pj.tenant_id=?`. No row leaks between branches because OAuth rows lack `provider='telegram'` and Telegram rows have no `publishing_channels` JOIN match.

## Medium findings (🟡)

- **Hook 140 LOC vs plan's 80 LOC target.** Justified — adaptive interval + visibility + abort + terminal-detection logic genuinely needs this footprint. Splitting would harm readability.
- **Polling backoff does NOT reset on visibility resume.** Elapsed timer keeps running while hidden, so a tab hidden for 90s resumes directly into slow phase. Acceptable per plan intent (tab-hidden ≠ fresh start).
- **i18n parity gap (MINOR).** Plan claims `+5 keys`; only 3 found in both en.json and vi.json (`title`, `empty`, `attempts`). Remaining 2 are not referenced in the component, so no runtime breakage — but plan claim is inaccurate. Component uses `t('status.${status}')` from existing keys (parent `dashboard.distribute.status.*`), which is correct.
- **`statusStyle` for unknown status falls back to `'scheduled'` style** silently — fine but log a warn for unknown statuses to surface upstream provider drift.

## Low findings (🟢)

- All files <200 LOC ✅
- Zero `:any` ✅
- VI translations natural ✅ ("Trạng thái phân phối", "Số lần thử")
- Kebab-case file naming ✅
- "Live" badge text in component is hardcoded English — should also be `t()`-wrapped for VI parity.

## Test quality

5 route tests + 4 hook tests cover the documented matrix. Mocks match real D1 chain shape (no fictional fields). Hook tests use fake timers correctly.

## Recommended actions (non-blocking)

1. Wrap "Live" badge in `t('statusPanel.live')` and add to en.json/vi.json.
2. Update plan doc to reflect actual 3 keys added (not 5).
3. Consider truncate-then-redact ordering for `sanitizeError`.

## Unresolved questions

- Should `tenant_id` ever differ from `user.id` for Telegram path in single-tenant mode? The route assumes equality; verify this invariant holds for all FREE100 onboarding paths.
