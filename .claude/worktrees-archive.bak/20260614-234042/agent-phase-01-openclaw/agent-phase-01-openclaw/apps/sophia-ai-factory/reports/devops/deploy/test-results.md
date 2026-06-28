# Smoke Test Results — 2026-05-30 02:38 UTC-7

## Test Summary

| # | Endpoint | Expected | Actual | Time | Result |
|---|---|---|---|---|---|
| 1 | `GET /` (Homepage) | 200 | 200 | 2.80s | ✅ PASS |
| 2 | `GET /api/version` | 200 + JSON | 200 | ~0.5s | ✅ PASS |
| 3 | `GET /login` | 200 | 200 | 0.73s | ✅ PASS |
| 4 | `GET /dashboard/sop-marketplace` | 307 (auth redirect) | 307 | 1.55s | ✅ PASS |
| 5 | `GET /dashboard/sops` | 307 (auth redirect) | 307 | 1.70s | ✅ PASS |
| 6 | `GET /dashboard/sop-creator` | 307 (auth redirect) | 307 | 0.20s | ✅ PASS |
| 7 | `GET /api/sophia-index/health` | 200 | 500 | 5.38s | ⚠️ PRE-EXISTING |

## Verdict: ✅ PASS (6/7 — 1 pre-existing)

### Details

**Test 4-6 (307 redirects)**: All SOP dashboard pages correctly redirect to login for unauthenticated requests. This is expected behavior — the `getCurrentUser()` check fires and redirects to `/${locale}/login`.

**Test 7 (Health 500)**: Response body: `{"status":"error","message":"D1_ERROR: no such table: affiliate_categories: SQLITE_ERROR"}`. This is a **pre-existing migration gap** unrelated to the SOP bug fix changes. Migration `0135_agent_api.sql` creates this table but hasn't been applied to production D1.

### Version Verification

```json
{
  "shortSha": "f42efe8f",
  "deployedAt": "2026-05-30T03:25:19Z",
  "opennextVersion": "1.19.9"
}
```

Cloudflare Worker Version ID: `c8a05f8f-c31c-4ce8-87d1-1ed66d56d756`

## Changes Deployed

All 10 SOP bug fixes are live:
- XSS escape in sop-preview.tsx
- Timestamp nowSec() in marketplace repo
- N+1 → batch query in SOP list
- i18n translations for 3 pages
- SOP Creator detail page (was 404)
- submitForReviewAction Publish button
- getD1 null guard
- Duplicate test deleted
- Variable shadow fix
