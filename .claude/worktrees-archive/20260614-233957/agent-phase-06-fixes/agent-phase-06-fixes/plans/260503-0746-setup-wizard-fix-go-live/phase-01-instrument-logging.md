# Phase 01 — Instrument Logging

## Context Links

- Root cause analysis: [`../reports/debugger-260503-setup-wizard.md`](../reports/debugger-260503-setup-wizard.md) §H1-H4
- Fix #1 (critical, zero blast radius): "Add server-side logging in layout.tsx catch"

## Overview

- **Priority:** P1 (must precede Phase 02 — diagnostic prerequisite)
- **Status:** ✅ complete
- **ETA:** 30m
- **Brief:** Surface silent failures in `getSession()` / `getCurrentUser()` so production logs reveal which hypothesis (H1 cookie reject, H2 prefix mismatch, H3 D1 cold start) is real.

## Key Insights

- Current `catch { return null }` swallows all errors — prod is invisible
- Cloudflare Workers logs only show what we explicitly emit
- Logger already exists (used elsewhere in codebase) — just import + use
- Read-only diagnostic — zero functional change → safe to deploy fast

## Requirements

**Functional:**
- Log error type, message, stack in catch blocks of `getSession()` and `getCurrentUser()`
- Log MUST include request context: pathname (if available via headers), cookie names present (NOT values), error class
- Layout.tsx auth-gate catch must log before `redirect()`

**Non-functional:**
- No PII in logs (no cookie values, no email)
- Log level = `error` (visible in `wrangler tail` default)
- Use existing `logger` util, not raw `console.log`

## Architecture

```
layout.tsx (Server Component)
  → getCurrentUser() [src/lib/better-auth-session.ts]
    → getSession() — catch logs error reason
      → auth.api.getSession() — may throw on cookie reject / D1 fail
```

## Related Code Files

**Modify:**
- `apps/sophia-ai-factory/src/lib/better-auth-session.ts` — add `logger.error` in 2 catch blocks
- `apps/sophia-ai-factory/src/app/setup-wizard/layout.tsx` — add `logger.warn` when user null + log cookie keys

**Reference (no edit):**
- `apps/sophia-ai-factory/src/lib/logger.ts` (verify import path)

## Implementation Steps

1. Locate logger util — `grep -r "from.*logger" apps/sophia-ai-factory/src/lib/`. If none, use `src/lib/logger.ts` import path standard.
2. Edit `better-auth-session.ts`:
   - In `getSession()` catch: `logger.error('[better-auth-session] getSession failed', { error: String(err), name: err?.constructor?.name })`
   - In `getCurrentUserFromHeaders()` catch: same pattern
   - Convert `catch {` → `catch (err)` to capture error
3. Edit `setup-wizard/layout.tsx`:
   - Before `redirect("/login?...")`, log: `logger.warn('[setup-wizard] no user — redirecting', { cookieNames: cookies().getAll().map(c => c.name) })`
   - Use `next/headers` `cookies()` — already in Server Component context
4. Run `cd apps/sophia-ai-factory && npm run build` → verify 0 TS errors
5. Commit: `chore(auth): instrument session catch + setup-wizard layout for prod diagnostics`
6. Push → wait for deploy GREEN → check `wrangler tail` for emerging errors when user reports magic-link click

## Todo List

- [x] Confirm logger import path (`@/lib/utils/logger-utility`)
- [x] Edit `better-auth-session.ts` (2 catch blocks — `getSession` + `getCurrentUserFromHeaders`)
- [x] Edit `setup-wizard/layout.tsx` (1 warn + cookie names logged before redirect)
- [x] `npm run build` passes (0 TS errors)
- [ ] Commit + push (deferred — user handles)
- [ ] Verify deploy GREEN via `gh run view`
- [ ] `wrangler tail` ready for Phase 02 evidence

## Success Criteria

- Build passes 0 errors
- Pushed commit deploys GREEN
- `wrangler tail` produces structured log on next failed magic-link → setup-wizard hop
- Log reveals: D1 error vs invalid signature vs missing cookie vs name mismatch

## Risk Assessment

| Risk | Likelihood | Mitigation |
|------|-----------|------------|
| Logger module path wrong → build fail | Low | grep first, verify import |
| Log spam if every cold visit logs warn | Med | warn level not error; rotate if noisy |
| Catching `err` breaks lint (`no-unused-vars`) | Low | Use `err` in log message |

## Security Considerations

- Do NOT log cookie VALUES — only NAMES
- Do NOT log session token, user email, or full headers
- Do NOT log full stack trace if it contains secrets — use `error.message` + `error.name` only

## Next Steps

- Phase 02 depends on logs from this phase to confirm H1 vs H2 vs H3
- If logs show D1 connection error → Phase 02 adds retry logic instead of cookie fix
- If logs show signature mismatch → Phase 02 focuses on `cookiePrefix` + signing alignment
