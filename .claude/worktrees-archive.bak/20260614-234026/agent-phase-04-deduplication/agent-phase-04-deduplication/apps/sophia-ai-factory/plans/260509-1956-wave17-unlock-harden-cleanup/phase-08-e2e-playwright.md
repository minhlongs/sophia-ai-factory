# Phase 08 — E2E Playwright Tests for FREE100 Flow

## Context Links

- Existing Playwright config: `apps/sophia-ai-factory/playwright.config.ts` (already configured)
- Existing E2E tests: `tests/e2e/api-endpoints.spec.ts`, `auth-flow.spec.ts`, `checkout-flow.spec.ts`, `dashboard.spec.ts`, `guide-pages.spec.ts`, `smoke.spec.ts`
- npm script: `"test:e2e": "NEXT_PUBLIC_MOCK_AI_SERVICES=true playwright test"`
- FREE100 entry flow: magic-link → onboarding → AI prompt → SSE → video → distribute
- AiPromptForm: `src/app/[locale]/dashboard/videos/new/components/ai-prompt-form.tsx`
- Render progress (SSE): `src/app/[locale]/dashboard/videos/new/components/render-progress.tsx`
- Distribute panel: `src/app/[locale]/dashboard/videos/[id]/distribute/page.tsx`

## Overview

- **Priority:** P2
- **Status:** 🔄 deferred (Wave 18)
- **Effort:** 2-3 dev-days

Add three FREE100 flow E2E tests under existing Playwright setup. Reuse `NEXT_PUBLIC_MOCK_AI_SERVICES=true` pattern to mock Inngest + Bot API.

**Decision:** Deferred to Wave 18 per planner recommendation as standalone effort. CEO Phase 03 smoke test covers unlock chain manually for Wave 17 ship. E2E offers high value but 2-3d effort warrants dedicated phase.

## Key Insights

1. **Playwright already configured** — config + tests dir + npm script all present. Phase scope is "add 3 tests + mocking helpers", NOT "set up Playwright".
2. **`NEXT_PUBLIC_MOCK_AI_SERVICES=true` env var** already gates AI service mocks — pattern exists, follow it.
3. **Inngest local mocking:** for E2E that runs against `npm run dev` (per playwright.config webServer block), Inngest functions don't actually fire unless Inngest dev server runs. For E2E, we need to either:
   - Stub the `inngest.send()` call to immediately complete the engine_mission with a fake R2 URL.
   - Bypass Inngest entirely with a test-only env flag (`E2E_INSTANT_VIDEO_GEN=true`) that short-circuits video-generate to insert mock outputs.
4. **Telegram Bot API mocking:** intercept fetch via Playwright `page.route()` to `https://api.telegram.org/**` → return stub `{ message_id: 12345, ... }`.
5. **CI integration:** existing test:e2e runs locally; CI integration NOT mandatory for Wave 17 (CF-direct doctrine — no GitHub Actions). Add a manual `npm run test:e2e` to deploy verify checklist.

## Requirements

### Functional

Three Playwright specs:

1. **`free100-magic-link.spec.ts`**:
   - Visit `/en/login` → enter test email → submit magic link form.
   - Mock the magic-link email delivery (test endpoint or stub).
   - Visit magic-link URL → should redirect to `/en/dashboard/onboarding`.
   - Click "Skip" or "I'll do it later" → should land on `/en/dashboard`.

2. **`free100-video-generation.spec.ts`**:
   - Sign in as test user (reuse auth-flow helper).
   - Visit `/en/dashboard/videos/new`.
   - Enter prompt, select style/language, submit.
   - Mock SSE endpoint (`/api/v1/missions/{id}/stream`) to emit `status=succeeded` with mock R2 URL within 5s.
   - Assert `<video>` element renders with the mock URL playable (skip actual playback).

3. **`free100-distribute-telegram.spec.ts`**:
   - Sign in + create completed video (via DB seed or reuse video from #2).
   - Mock Telegram pairing as already complete (DB seed).
   - Visit `/en/dashboard/videos/{id}/distribute`.
   - Tick Telegram checkbox → submit Distribute.
   - Mock POST to `/api/v1/videos/{id}/distribute` → returns `{ jobIds: [...] }`.
   - Mock Bot API via `page.route('https://api.telegram.org/**')`.
   - Assert UI shows "Distributed" / "Live" state (or whatever the success UI is).
   - Verify D1 `publishing_jobs` row inserted (if test framework allows DB query) OR rely on mocked fetch interception count.

### Non-functional

- Each spec runs in <60s.
- Tests parallel-safe (Playwright `fullyParallel: true` already configured).
- No flaky network calls — all external services mocked.

## Architecture

### Test data setup

Create `tests/e2e/_fixtures/free100-fixtures.ts`:
- `seedTestUser({ email, tier: 'MASTER' })` — DB-seed via local D1 + `wrangler d1 execute --local`.
- `seedCompletedVideo({ userId, r2Key })` — INSERT into local D1 videos table.
- `seedTelegramPairing({ userId, chatId })` — INSERT into local D1 telegram_paired_chats.
- `tearDown()` — DELETE seeded rows after test.

### Mocking helpers

`tests/e2e/_fixtures/sse-mock.ts`:
- Use Playwright `page.route('/api/v1/missions/*/stream')` to intercept and respond with SSE-formatted body emitting status events.

`tests/e2e/_fixtures/telegram-mock.ts`:
- `page.route('https://api.telegram.org/**', route => route.fulfill({ json: { ok: true, result: { message_id: 1 } } }))`.

### Local dev server requirement

`playwright.config.ts` already starts `npm run dev` for local runs. Confirm the dev server picks up `E2E_INSTANT_VIDEO_GEN=true` env (add to `package.json` test:e2e script).

## Related Code Files

### Modify

- `package.json` — extend `test:e2e` script with mock env vars: `"NEXT_PUBLIC_MOCK_AI_SERVICES=true E2E_INSTANT_VIDEO_GEN=true playwright test"`.
- `src/forest/inngest/functions/video-generate.ts` — add early-return guard `if (process.env.E2E_INSTANT_VIDEO_GEN === 'true') { ...stub completion... }`. Modify only with strict `process.env.NODE_ENV !== 'production'` guard layered on top to PREVENT prod misuse.
- Existing test helpers if any auth fixture exists (check `tests/e2e/auth-flow.spec.ts` for reusable login).

### Create

- `tests/e2e/free100-magic-link.spec.ts`
- `tests/e2e/free100-video-generation.spec.ts`
- `tests/e2e/free100-distribute-telegram.spec.ts`
- `tests/e2e/_fixtures/free100-fixtures.ts` (DB seed/teardown)
- `tests/e2e/_fixtures/sse-mock.ts`
- `tests/e2e/_fixtures/telegram-mock.ts`

### Delete

- None.

## Implementation Steps

1. **Audit existing E2E fixtures** — read `tests/e2e/auth-flow.spec.ts` for reusable login helper. If absent, build minimal one in `_fixtures/auth.ts`.
2. **Define mock env vars + safe guards** — `E2E_INSTANT_VIDEO_GEN` short-circuit must hard-fail in production.
3. **Write fixtures** — DB seed/teardown helpers using `child_process.execSync('npx wrangler d1 execute --local ...')` OR direct better-sqlite3 connection if local D1 path known.
4. **Write `free100-magic-link.spec.ts`** first (smallest scope, fastest feedback).
5. **Write `free100-video-generation.spec.ts`** with SSE mock.
6. **Write `free100-distribute-telegram.spec.ts`** with Bot API mock.
7. **Run `npm run test:e2e` locally** — all 3 pass.
8. **Document in deploy checklist** — add "run `npm run test:e2e` before each `npm run deploy:full`" to `sophia-deploy-verify.md`.
9. **Build:** `npm run build` (E2E env guards must not break prod build).
10. **Deploy + SHA verify** (no smoke test needed; E2E IS the smoke).

## Todo List (Wave 18)

- [ ] Audit existing E2E fixtures + auth helper
- [ ] Add `E2E_INSTANT_VIDEO_GEN` env var with prod guard
- [ ] Write DB seed/teardown fixtures
- [ ] Write SSE mock helper
- [ ] Write Telegram Bot API mock helper
- [ ] Write magic-link spec (all assertions pass)
- [ ] Write video-generation spec
- [ ] Write distribute-telegram spec
- [ ] Run `npm run test:e2e` — all 3 green
- [ ] Update deploy-verify rule with E2E checklist line
- [ ] Build + deploy + SHA verify

## Success Criteria

- 3 new Playwright specs in `tests/e2e/free100-*.spec.ts`.
- Local `npm run test:e2e` passes all (including pre-existing tests).
- Each new test runs <60s.
- E2E env guards prevent production accidental short-circuit.
- Deploy-verify rule mentions E2E run.

## Risk Assessment

| Risk | Probability | Impact | Mitigation |
|---|---|---|---|
| Inngest mocking complexity exceeds 1d budget | Medium | Medium | Use `E2E_INSTANT_VIDEO_GEN` short-circuit instead of mocking Inngest infra |
| `E2E_INSTANT_VIDEO_GEN` accidentally enabled in prod | Very Low | Critical | Hard `NODE_ENV !== 'production'` guard + grep CI check |
| Local D1 seed/teardown flaky | Medium | Medium | Use better-sqlite3 directly OR isolate to per-test sqlite file |
| Magic-link email mock complex (Better Auth internals) | Medium | Medium | Use direct DB seed of session token instead of full email flow |
| Bot API mock misses real-world response shape | Low | Low | Already mocked in unit tests for telegram-publisher; copy shape |

## Security Considerations

- `E2E_INSTANT_VIDEO_GEN` short-circuit MUST hard-fail in production. Guard pattern:

```ts
if (process.env.E2E_INSTANT_VIDEO_GEN === 'true') {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('E2E_INSTANT_VIDEO_GEN cannot be enabled in production');
  }
  // ... short-circuit logic
}
```

- DB seed helpers operate on LOCAL D1 only — no remote D1 writes from E2E.
- Test user emails namespaced (`e2e-{uuid}@test.invalid`) to avoid colliding with real users.

## Next Steps

- Independent — does not block other phases.
- Wave 18 candidate: extend coverage to OAuth provider distribute paths (TikTok, YouTube, etc.) once those flows stabilize.
- Wave 18 candidate: integrate test:e2e into a pre-deploy hook script.

## Deferral Notes (Wave 17 Phase 08 — 2026-05-09)

### Status: 🔄 DEFERRED to Wave 18

**Reason:** Standalone 2-3d effort with minimal blocking impact on Wave 17 unlock chain. CEO Phase 03 smoke test covers end-to-end manually. E2E Playwright offers high regression value but warrants dedicated phase.

**Wave 18 entry criteria:**
- Phase 05 D1Client.unwrap() accessor added
- Phase 07b orphan components + i18n keys cleaned (optional but preferred)
- Full Playwright focus (no competing tasks)

### Wave 18 Phase-08 Planning Notes

Scope: 3 specs (magic-link, video-generation, distribute-telegram) + 3 mocking helpers (free100-fixtures, sse-mock, telegram-mock).

**Complexity hotspots to plan for:**
1. Inngest mocking strategy — prefer `E2E_INSTANT_VIDEO_GEN` short-circuit over full infra mock
2. Local D1 seed/teardown — Better Auth session table structure + safer per-test isolation
3. SSE mock response shape — align with real `/api/v1/missions/{id}/stream` contract

**Risk mitigations in Wave 18 plan:**
- Start with magic-link spec (smallest scope, fastest feedback)
- Defer video-generation + distribute-telegram if fixtures >0.5d
- Hard NODE_ENV guard on E2E_INSTANT_VIDEO_GEN to prevent prod accidental enable

## Unresolved (for Wave 18 planning)

- Does Better Auth expose a test-only "issue session for email" admin API? If yes, magic-link mock is trivial. If no, seed `session` table directly.
- Local D1 path: where does `wrangler d1 execute --local` write the SQLite file? (Typically `.wrangler/state/...`. Verify before fixture writes.)
- SSE response contract — does Inngest-triggered `/api/v1/missions/{id}/stream` emit `status=succeeded` with R2 URL in body? (Copy from existing mock or integration test if available.)
