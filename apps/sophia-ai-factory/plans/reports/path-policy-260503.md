# Default-Deny File Upload Policy — 2026-05-03

## Discovery

Scanned `src/app/api` for `formData|multipart|filename|filepath|uploadFile`, `R2.*put|R2_BUCKET|VIDEO_BUCKET`, and `fs\.` patterns.

**Routes examined:** 10 candidates
**Real file-upload endpoints: 1**
- `POST /api/voices` — `multipart/form-data` with audio Blob → R2 upload. Missing: size ceiling, MIME allowlist.

**Other routes — not in scope:**
- `/api/internal/tts` + `/api/internal/render-py` — JSON bodies, R2 keys generated server-side, token-gated internal routes. No user-controlled paths.
- `/api/admin/migrations/[filename]` — filename already regex-sanitised (`/^[\w\-. ]+\.sql$/`), read-only metadata ops.
- `/api/admin/audit/reports/download/[id]` — download by DB record ID, no user path control.
- `/api/usage/export/*`, `/api/account/export`, `/api/analytics/export` — CSV/JSON export writers, no inbound file path.
- `fs.*` matches: **0** (pure CF Workers context — symlink traversal N/A).

## Files Modified

| File | Action |
|------|--------|
| `src/seed/security/file-upload-policy.ts` | Created — utility (~90 lines): `enforceFileSizeLimit`, `enforceMimeAllowlist`, `safeStorageKey`, `FileUploadPolicyError` |
| `src/seed/security/__tests__/file-upload-policy.test.ts` | Created — 21 vitest tests |
| `src/app/api/voices/route.ts` | Updated — applied size ceiling (10 MB) + MIME allowlist before body read |

## Test Results

```
21 passed / 21 total — file-upload-policy.test.ts
```

## TypeScript Check

`tsc --noEmit` — **0 errors** in new/modified files. Pre-existing errors in unrelated test mocks (billing, fulfillment, telegram) are not caused by this change.

## Policy Applied per Route

### POST /api/voices
1. **Size ceiling** — `enforceFileSizeLimit(request, 10 MB)` before `formData()` read; returns 413 on violation.
2. **MIME allowlist** — `enforceMimeAllowlist(file.type, ['audio/wav','audio/x-wav','audio/mpeg','audio/ogg','audio/webm','audio/mp4'])`; returns 415 on mismatch.
3. **Hardcoded prefix** — R2 key is `tenants/${tenantId}/voices/${voiceId}/ref.wav` — no user input in path. `safeStorageKey` utility available for future routes that do accept user filenames.
4. **Tenant scoping** — `getCurrentUser()` + `tenantId` from session (pre-existing, unchanged).

## Skipped / N/A

- Symlink traversal check: N/A — CF Workers environment, no `fs` access.
- `safeStorageKey` not called in `/api/voices` because the R2 key is already fully server-generated (voiceId = `crypto.randomUUID()`). Utility is future-proof for any route that does accept user-supplied filenames.
