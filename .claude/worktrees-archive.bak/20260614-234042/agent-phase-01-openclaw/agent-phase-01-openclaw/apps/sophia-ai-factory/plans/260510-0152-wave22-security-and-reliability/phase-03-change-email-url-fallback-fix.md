---
phase: 03
title: "Fix silent `#` URL fallback when NEXT_PUBLIC_APP_URL missing"
priority: P2/MED/UX
status: complete
effort_estimate: 0.5h
effort_actual: ~20m
completed: 2026-05-10
dependencies: []
---

# Phase 03 — Change-Email URL Fallback Fix

## Context Links

- W20 review finding #4: `plans/260510-0115-wave21-hardening-and-docs/reports/code-reviewer-wave20-2026-05-10.md` lines 46–48
- Affected file: `src/app/api/account/change-email/route.ts:96` and `change-email/route.ts:114-118` (template helper)
- Same pattern in `delete/request/email-template.ts:7-10`

## Goal

Replace silent `#` fallback with explicit error path when `NEXT_PUBLIC_APP_URL` is unset. Currently a misconfigured deploy silently sends emails containing dead `#` links — user clicks, page reloads, no error surfaced.

## Key Insights

1. **Two failure modes exist:**
   - Env unset → `process.env.NEXT_PUBLIC_APP_URL` is `undefined` → caller code already falls back to hardcoded `https://sophia.agencyos.network` (line 96 of route.ts and line 26 of verify/route.ts). This part is OK.
   - Template helper takes `rawUrl` param → if helper receives a value not starting with `https://` or `http://localhost` → silent `#` (line 117–118).
2. **The bug is in the template helper, not the env read.** Caller always passes a valid URL because of the `??` fallback. So only attack/misconfig case: someone passes a non-https URL deliberately. Defensive but currently silent.
3. **Same anti-pattern in `delete/request/email-template.ts:7-10`.** Fix both.

## Architecture

```
BEFORE:
  buildChangeEmailHtml(rawUrl, ...) →
    if rawUrl starts with https:// or http://localhost → use it
    else → "#" (silent no-op link in email)

AFTER:
  buildChangeEmailHtml(rawUrl, ...) →
    if rawUrl starts with https:// or http://localhost → use it (escaped)
    else → throw new Error('Invalid email URL: must be https:// or http://localhost')
  Caller (route.ts) catches → logs → returns 500 to client.
```

## Files to Create

None.

## Files to Modify

| File | Change |
|---|---|
| `src/app/api/account/change-email/route.ts` | Add `if (!process.env.NEXT_PUBLIC_APP_URL) logger.warn(...)`; keep hardcoded fallback. Wrap `buildChangeEmailHtml` in try/catch; return 500 on throw |
| `src/app/api/account/delete/request/email-template.ts` | Replace silent `#` fallback with `throw new Error('Invalid email URL ...')` |
| `src/app/api/account/change-email/route.ts` (helper) | Same change in `buildChangeEmailHtml` |
| `src/app/api/account/change-email/__tests__/*.test.ts` | +1 test: invalid URL passed → throws |
| `src/app/api/account/delete/__tests__/account-delete.test.ts` | +1 test: invalid URL → throws |

## Implementation Steps

1. **In `change-email/route.ts:114-119`** replace:
   ```ts
   const url =
     rawUrl.startsWith('https://') || rawUrl.startsWith('http://localhost')
       ? rawUrl.replace(/"/g, '&quot;').replace(/</g, '&lt;')
       : '#';
   ```
   with:
   ```ts
   if (!rawUrl.startsWith('https://') && !rawUrl.startsWith('http://localhost')) {
     throw new Error(`[change-email] Invalid email URL: ${rawUrl}`);
   }
   const url = rawUrl.replace(/"/g, '&quot;').replace(/</g, '&lt;');
   ```
2. **Same fix in** `delete/request/email-template.ts:7-10`.
3. **In `change-email/route.ts:99-109`** wrap the existing `try { sendEmail(...) }` to also catch template-throw:
   - Move the `buildChangeEmailHtml(...)` call INSIDE the try block.
   - Catch path → `logger.error('[change-email] template/send failed', toError(err)); return NextResponse.json({error: 'Failed to send'}, {status: 502});`.
4. **Add log warning when env unset:**
   ```ts
   if (!process.env.NEXT_PUBLIC_APP_URL) {
     logger.warn('[change-email] NEXT_PUBLIC_APP_URL not set; using fallback');
   }
   const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://sophia.agencyos.network';
   ```
   Same for `delete/request/route.ts`.
5. **Add tests:** invalid URL (e.g., `javascript:alert(1)` or `ftp://...`) → template helper throws.
6. **Run** `npm run build && npm test`.

## Migration

None.

## i18n Keys

None.

## Test Strategy

| Test | Type | Expected |
|---|---|---|
| Template throws on `javascript:` URL | unit | throw |
| Template throws on `ftp://` URL | unit | throw |
| Template accepts `https://` URL | unit | returns escaped HTML |
| Template accepts `http://localhost:3000` URL | unit | returns escaped HTML |
| Route returns 502 when template throws | integration | 502 + log entry |

Target: +5 new tests across 2 test files.

## Success Criteria

- [ ] No silent `#` fallback in either email template
- [ ] Invalid URL produces logged error + non-success response
- [ ] All tests pass + 5 new
- [ ] Deploy SHA match
- [ ] Manual: in staging, unset `NEXT_PUBLIC_APP_URL`, observe warning log

## Risk Assessment

- **R1: Throwing in template breaks existing flow** — caller must catch. Verified change-email already has try/catch around sendEmail; we expand its scope.
- **R2: env-not-set in dev** — local dev usually has `NEXT_PUBLIC_APP_URL=http://localhost:3000` in `.env.local`; if not, the hardcoded fallback `https://sophia.agencyos.network` kicks in (already present). Tests run with mocked envs.

## Security Considerations

- Eliminates user-confusion vector (dead link emailed).
- Defensive: prevents accidental injection of `javascript:` or `data:` URLs into mailed HTML even if env-poisoned.

## Verification Steps

```bash
cd apps/sophia-ai-factory
npm run build               # 0 TS errors
npm test                    # all pass + 5 new
npm run deploy:full
# SHA match check (standard)
```

## Next Steps

- Quick win; no deps blocked.
- Phase 07 (DRY refactor) will inherit this hardened helper shape.
