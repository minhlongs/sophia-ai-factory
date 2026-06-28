# Phase 04 — Test Verification (Pre-Push Gate)

## Context Links

- Phases 02 (cookie fix) + 03 (i18n) ready to push
- Sophia rule: `npm test` must pass before push
- Binh Pháp Quality: `~/.claude/rules/binh-phap-quality.md`

## Overview

- **Priority:** P1 (gate to Phase 05 push)
- **Status:** pending
- **ETA:** 60m
- **Brief:** Unit tests for session helpers + manual smoke test (browser, magic-link flow) + `wrangler tail` validates no errors.

## Key Insights

- Phase 02 changes are HIGH RISK (auth = whole-app blast radius) — extensive testing required
- Cannot fully test cookie chain without real D1 + real Better Auth → use `wrangler dev --remote`
- Tests must NOT mock D1 (Sophia rule: no fake data, no temporary fixes)
- Manual browser test = source of truth (Rule 13 — checkout verification)

## Requirements

**Functional:**
- Unit tests for `getSession()`, `getCurrentUser()`, `getCurrentUserFromHeaders()` — happy path + error paths
- Unit tests for `signCookieValue()` HMAC scheme correctness vs Better Auth reference vectors
- Manual smoke: cold visit /setup-wizard → 307 (expected) ; magic-link consume → /setup-wizard 200
- `wrangler tail` shows zero `[better-auth-session] getSession failed` errors during smoke

**Non-functional:**
- Test runtime < 60s
- 0 flaky tests
- Coverage > existing baseline for touched files

## Architecture

```
Test Layer
  ├── unit:    src/lib/better-auth-session.test.ts   (Vitest, no DB)
  ├── unit:    src/lib/auth/sign-cookie-value.test.ts (Vitest, pure fn)
  └── smoke:   manual browser checklist              (real prod-like env)

Validation
  ├── npm run build   (0 errors)
  ├── npm run lint    (0 errors)
  ├── npm test        (all green)
  └── wrangler tail   (5 min observation, zero errors)
```

## Related Code Files

**New:**
- `apps/sophia-ai-factory/src/lib/better-auth-session.test.ts`
- `apps/sophia-ai-factory/src/lib/auth/sign-cookie-value.test.ts` (if absent)

**Reference:**
- `apps/sophia-ai-factory/vitest.config.ts` (verify config)
- `apps/sophia-ai-factory/package.json` (test script)

## Implementation Steps

### Sub-Phase 04A: Unit Tests (delegate to `tester` agent)

Tester prompt:
> Write Vitest unit tests for:
> 1. `src/lib/better-auth-session.ts` — mock `getAuth()`, test getSession returns null on throw + logs error; test getCurrentUser maps fields correctly; test header-based variant works.
> 2. `src/lib/auth/sign-cookie-value.ts` — verify HMAC-SHA256 + base64url encoding matches Better Auth reference (use known input/output pairs from better-call/crypto).
> Work context: /Users/macbook/projects/sophia-ai-factory
> Reports: /Users/macbook/projects/sophia-ai-factory/plans/reports/
> Run from: apps/sophia-ai-factory/
> NO mocks for HMAC — use real Web Crypto API.

### Sub-Phase 04B: Static Checks

```bash
cd apps/sophia-ai-factory
npm run build        # 0 errors
npm run lint         # 0 errors
grep -r ": any" src --include="*.ts" --include="*.tsx" | wc -l  # = 0
grep -r "console\." src/lib/better-auth-session.ts src/app/setup-wizard/layout.tsx | wc -l  # = 0
npm test             # all pass
```

### Sub-Phase 04C: Manual Smoke Test (`wrangler dev --remote`)

```bash
cd apps/sophia-ai-factory
npx wrangler dev --remote
```

Browser checklist:
1. Cold visit `http://localhost:8787/setup-wizard` (no cookies) → expect 307 to /login (CORRECT)
2. Admin: create test handover for test email → magic link generated
3. Click magic link → DevTools Network: `POST /api/welcome/validate/{token}` → status 200
4. DevTools Application → Cookies: `__Secure-better-auth.session_token` present, attrs: HttpOnly + Secure + SameSite=Lax + Path=/
5. Auto-redirect to `/setup-wizard` → page LOADS (200, not 307)
6. Check page shows VN strings (no "Ai Keys", "Launch" placeholders)
7. Complete wizard → API key save → redirect to /dashboard succeeds
8. `wrangler tail` (separate terminal) — verify zero `[better-auth-session]` errors during entire flow

### Sub-Phase 04D: i18n Sync Check

```bash
cd apps/sophia-ai-factory
# extract all setupWizard keys used in code
grep -rohE "['\"]setupWizard\.[a-zA-Z._]+['\"]" src/app/setup-wizard | sort -u > /tmp/used.txt
# verify each exists in both locales
while read key; do
  k=$(echo "$key" | tr -d "'\"")
  python3 -c "import json; d=json.load(open('messages/vi.json')); ks='${k}'.split('.'); v=d
  [v:=v[p] for p in ks]; print('vi OK')" 2>&1 | grep -v "vi OK" && echo "MISSING vi: $k"
done < /tmp/used.txt
```

## Todo List

- [ ] Delegate unit tests to `tester` agent (04A)
- [ ] Tester reports green — read summary
- [ ] Static checks pass (04B)
- [ ] `wrangler dev --remote` running
- [ ] Manual browser smoke 8-step checklist passes
- [ ] `wrangler tail` zero errors during smoke
- [ ] i18n sync check produces zero MISSING (04D)
- [ ] Code review delegated to `code-reviewer` agent
- [ ] All findings addressed

## Success Criteria

- All unit tests green
- Build + lint pass, 0 :any, 0 console
- Manual smoke: magic-link → /setup-wizard loads (NOT 307)
- VN strings render correctly
- Zero session errors in wrangler tail
- Code review passes (no major findings)

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| `wrangler dev --remote` differs from prod CF Workers | Low | High | Use same wrangler.jsonc; remote mode connects to actual D1 |
| Test mocks hide real bug | Med | High | Sophia rule: no mocks for critical paths; use real crypto |
| Magic-link tester email unavailable | Med | Med | Use admin creates handover for own test address |
| Flaky D1 test on cold start | Med | Med | Retry once; if persistent, file as Phase 02 follow-up |

## Security Considerations

- Use TEST email domain (not real customer)
- Revoke test handover after smoke complete
- Do NOT commit test cookies / tokens
- `wrangler tail` may expose tokens — review before sharing logs

## Next Steps

- ALL checks green → proceed to Phase 05 (push + verify production)
- ANY check red → fix → re-run from failing point
- Code reviewer findings → address before push
