# Phase 04 — Login/Register E2E Verification

**Priority:** P1 High | **Effort:** 1h | **Status:** Complete | **Blocked by:** Phase 03

## Context

After Phase 1 UI Redesign (10 screens deployed including login), the E2E auth-flow tests must be verified against the new amber-themed components. The auth-flow spec (`tests/e2e/auth-flow.spec.ts`) tests **unauthenticated flows only** — no real credentials, no D1 writes. This makes it the lowest-risk E2E to verify.

## Test Coverage (auth-flow.spec.ts)

| Test | What it checks | Dom selectors |
|------|---------------|---------------|
| `/login` page renders login form | Email input visible, submit button visible | `input[type="email"]`, `form button[type="submit"]` |
| `/setup-wizard` page loads with step indicator | Page renders content (h1 or step indicator) | `h1`, `[data-testid="step-indicator"]` |
| Login with invalid credentials shows error | Fills email + password, submits, stays on login page | `input[type="email"]`, `input[type="password"]`, `form button[type="submit"]` |
| Unauthenticated `/dashboard` redirects to login | Goes to dashboard URL, gets redirected | URL check |

## Redesign Impact Analysis

### Login form selectors used by E2E

1. `input[type="email"]` — Standard HTML type. Unaffected by redesign.
2. `input[type="password"]` — Standard HTML type. Unaffected by redesign.
3. `form button[type="submit"]` — Standard HTML. **Could break if new login component uses a different button pattern** (e.g., `<Button type="submit">` rendered as a `<div>` instead of `<button>`).
4. `h1` — Standard heading. Unaffected.
5. `[data-testid="step-indicator"]` — Data attribute. **Depends on setup wizard having this testid.** Currently NOT present in `wizard-stepper.tsx`. The test uses `.or()` fallback to `h1`.

### Potential failures

1. **Login form redesigned to use `<div>` buttons** — `form button[type="submit"]` selector fails. Fix: add `data-testid="login-submit"` to the login form button, update E2E selector.
2. **Password toggle button text changed** — Test filters by `/mật khẩu|password/i`. If new login page uses different text, the password toggle won't be found. However, the test handles this gracefully (checks `if visible`).
3. **Setup wizard step indicator missing** — Test uses `.or()` fallback to `h1`. If both are absent, test fails. The setup wizard currently has no `data-testid="step-indicator"`. Fix: add it to `wizard-stepper.tsx`.
4. **Locale redirects change** — Test expects `/vi/dashboard` to redirect to a login URL. If the middleware redirect logic changed, the URL pattern may not match.

## Implementation Sequence

1. Run E2E tests with current components:
   ```bash
   npm run test:e2e -- tests/e2e/auth-flow.spec.ts --reporter=list
   ```
2. Analyze results — categorize each failure as:
   - **Selector mismatch** (new component uses different DOM) → update selector
   - **Missing data-testid** → add `data-testid` to component
   - **Redirect behavior changed** → investigate middleware
   - **Server not started / D1 error** → Phase 03 issue
3. Fix selector issues in E2E test OR add data-testid attributes to components (prefer data-testid — more stable than element selectors)
4. Re-run E2E — all 4 tests must pass
5. Run full E2E suite (`npm run test:e2e`) as sanity check — no new failures from auth-flow changes

## Fix Playbook (per test)

### Test 1: `/login` page renders login form

**If fails:**
- Check login component at `src/components/stitch/screens/login/login-form.tsx` and `login-page.tsx`
- Verify email input has `type="email"`
- Verify submit button is `<button type="submit">` (not `<button type="button">`)
- If button is `<Button>` component from `@/seed/components/ui/button`, verify it renders as `<button>` (it should — Shadcn Button renders a real `<button>`)
- Fallback fix: add `data-testid="login-email"` and `data-testid="login-submit"`

### Test 2: `/setup-wizard` page loads with step indicator

**If fails:**
- Current `wizard-stepper.tsx` has NO `data-testid="step-indicator"`
- Add to the stepper container div: `data-testid="step-indicator"`
- Or rely on `h1` fallback (welcome-step has `<h2>`, not `<h1>` — this may be the bug)
- Fix: add `<h1>` to the wizard container, or add `data-testid`

### Test 3: Login with invalid credentials shows error

**If fails:**
- This test depends on the password toggle text containing "mật khẩu" or "password"
- Check the login form's password mode toggle button text
- If text changed, update the regex `hasText: /mật khẩu|password/i`
- More robust fix: add `data-testid="login-password-toggle"`

### Test 4: Unauthenticated `/dashboard` redirects to login

**If fails:**
- Check `src/middleware.ts` redirect logic
- Verify `urlPattern` in test matches actual redirect URL
- Patterns currently accepted: `/login`, `/vi$`, `/en$`, `/$`, `/sign`
- If middleware now redirects to a different path, update the regex

## Files That May Need Changes

| File | Change | Risk |
|------|--------|------|
| `tests/e2e/auth-flow.spec.ts` | Update selectors for redesigned login form | Low — test file only |
| `src/components/stitch/screens/login/login-form.tsx` | Add `data-testid` attributes (if buttons changed) | Low — additive only |
| `src/tree/components/setup-wizard/wizard-stepper.tsx` | Add `data-testid="step-indicator"` | Low — additive only |
| `src/components/stitch/screens/login/login-page.tsx` | Ensure `<h1>` tag for heading | Low |

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Login button rendered as `<div>` (Shadcn Button `asChild`) | Low | Medium | Check Button component implementation. If `asChild`, wrapper with `<button>`. |
| Password toggle text changed in redesign | High | Low | Test handles gracefully with `if (await passwordToggle.isVisible())`. Low impact if it skips. |
| Setup wizard missing both `h1` and `data-testid` | Medium | Low | Add `data-testid` to stepper. Welcome step uses `<h2>` not `<h1>`. |
| Middleware redirect URL pattern changed | Low | Medium | Check middleware.ts `authGuard` redirect path. Likely unchanged. |

## Rollback

No rollback needed — E2E tests are non-destructive. If selector changes break other E2E tests, revert the selector change and fix the component to be compatible instead.

## Success Criteria

- [ ] All 4 auth-flow tests pass: `npm run test:e2e -- tests/e2e/auth-flow.spec.ts`
- [ ] `tests/e2e/checkout-flow.spec.ts` also passes (regression check)
- [ ] No new `data-testid` attributes break unit tests
- [ ] `npm run build` still exits 0 after any component changes
