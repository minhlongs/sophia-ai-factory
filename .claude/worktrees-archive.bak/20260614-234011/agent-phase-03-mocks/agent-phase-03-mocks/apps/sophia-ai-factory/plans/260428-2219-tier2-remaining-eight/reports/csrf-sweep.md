# CSRF Caller Sweep Report
Date: 2026-04-28

## Status: COMPLETE

## Files Modified (6/6)

| File | Endpoint | Change |
|------|----------|--------|
| `src/components/license/license-alert-panel.tsx` | POST `/api/alerts/:id/read` + `/dismiss` | Added `useCsrfToken` + spread into both mutation fetches |
| `src/components/missions/mission-control-header.tsx` | POST `/api/raas/missions` + `/api/agents/pause` | Added `useCsrfToken` + spread into both fetches; updated `handlePauseAll` dep array |
| `src/components/admin/licenses/use-license-list-actions.ts` | POST `/api/admin/licenses/:id/reactivate` | Added `useCsrfToken` + spread into reactivate fetch |
| `src/components/dashboard/referral-share-widget.tsx` | POST `/api/referral/generate` | Added `useCsrfToken` + spread into generate fetch |
| `src/components/raas/api-key-list.tsx` | DELETE `/api/admin/api-keys/:id` | Added `useCsrfToken` + spread into revoke fetch |
| `src/components/setup-wizard/local-mode-step.tsx` | DELETE `/api/setup/local-mode/provision` | Added `useCsrfToken` + spread into disable fetch |

## Pattern Applied
```tsx
const csrfHeaders = useCsrfToken();
// In fetch: headers: { 'Content-Type': 'application/json', ...csrfHeaders }
```

## Callers That Did NOT Need Changes
- None in the 6-file list — all were missing CSRF header prior to this sweep.
- GET-only callers (e.g. `fetchLicenses`, status polling) correctly excluded (CSRF not required for reads).

## Verification
- `npm run build` → exit 0 (0 TS errors)
- `npm test` → 1660 passed / 31 skipped (1691 total) — no regressions
