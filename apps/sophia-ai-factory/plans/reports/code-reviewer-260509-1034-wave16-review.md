# Wave 16 Code Review

## Verdict
- Score: 4.5/10
- Critical issues: 4
- Recommendation: **FIX_BEFORE_DEPLOY**

Tests pass because production schemas/auth paths are fully mocked. Production deploy will fail in 3 distinct ways. Unit-test green != deploy-ready.

---

## Critical (must fix before deploy)

### C1. `engine_missions` INSERT uses non-existent columns → silent insert failure → mission never runs
**File:** `src/app/actions/video-generate-action.ts:78-85`

```ts
await db.from('engine_missions').insert({
  id: missionId,
  user_id: user.id,
  tenant_id: tenantId,        // ← column does NOT exist
  status: 'pending',
  command: 'video.generate',
  input: JSON.stringify(...), // ← column does NOT exist (real col is `params`)
});
```

Schema (migrations 0052 + 0096) has columns: `id, user_id, command, params, status, result, error, credits_used, created_at, updated_at, completed_at, webhook_url, webhook_fired_at, output_video_url, output_audio_url, video_job_id`. **No `tenant_id`. No `input`.**

Sister code in `src/app/api/v1/missions/route.ts:88-95` (existing, working) inserts: `id, user_id, command, params (JSON), status, webhook_url`. Correct shape.

The D1 query builder (`d1-query-chain-executors.ts:75-93`) executes a literal `INSERT INTO engine_missions (id, user_id, tenant_id, status, command, input) VALUES (...)` — this throws "no such column: tenant_id" at runtime. `executeQuery` catches and returns `{data: null, error: {...}}`. **The action never inspects `.error`** → action returns `{success:true, missionId}` to the client → Inngest fires → worker `UPDATE engine_missions WHERE id=missionId` no-ops because the row was never inserted → mission stays "pending" forever from the user's view, SSE never reports terminal state.

Why tests pass: `__tests__/video-generate-action.test.ts:37-41` mocks `from` to a `vi.fn`. Schema never touched.

**Fix:** Match existing API contract.
```ts
await db.from('engine_missions').insert({
  id: missionId,
  user_id: user.id,
  command: 'video.generate',
  params: JSON.stringify({ prompt, style: parsed.data.style, language, tenantId }),
  status: 'pending',
});
// Also: check the returned `error` field and bail (return failure + release quota slot).
```

Add a real D1 integration test with `npx wrangler d1 execute --local` against a real schema.

---

### C2. SSE auth contract is broken — RenderProgress will 401 immediately for every browser user
**File:** `src/app/[locale]/dashboard/videos/new/components/render-progress.tsx:54-57`

```ts
// NOTE: SSE auth is via x-api-key or Bearer; the existing route uses
// validateMissionApiKey which also checks session cookies server-side.
// For browser EventSource (no custom headers), the server falls back to
// cookie-based auth — so no explicit header needed here.
const es = new EventSource(url);
```

The comment is **factually wrong**. `validateMissionApiKey` (`src/forest/missions/api-key-auth.ts:27-66`) reads ONLY `Authorization: Bearer ...` or `x-api-key` headers and SHA-256 looks up `raas_api_keys`. There is **no cookie-session fallback** anywhere in `/api/v1/missions/[id]/stream/route.ts`. EventSource cannot set custom headers.

Result: 401 → SSE dies → `es.onerror` only closes if state is already terminal (which it never becomes) → infinite reconnect loop spamming the server with 401s. The user sees the spinner stuck on "pending" forever.

**Fix (pick one):**
1. Add cookie-session fallback to `/api/v1/missions/[id]/stream/route.ts` (preferred — keep API key path for external integrations, add `getCurrentUser()` fallback when no header present).
2. Create a separate `/api/dashboard/missions/[id]/stream` route gated by `getCurrentUser()` only, and consume that here.
3. Mint a short-lived per-mission token server-side and pass via query string `?token=...` (least invasive).

Whichever you pick, **must include ownership check** (`mission.user_id === user.id`) — current API-key route does this implicitly since key→user_id mapping; cookie path needs explicit guard.

---

### C3. Migration 0098 references non-existent column `user.created_at` → migration apply will error
**File:** `migrations/0098-backfill-master-onboarding.sql:11`

```sql
SELECT created_at FROM user WHERE user.id = user_profiles.user_id LIMIT 1
```

The `user` table (migration 0003-better-auth.sql:7-16) has `createdAt TEXT` (camelCase, ISO datetime), NOT `created_at`. SQLite is case-insensitive on identifier *case* but `created_at` and `createdAt` are textually different identifiers (underscore vs no underscore). Apply will throw `no such column: created_at`.

Secondary issue even if you fix the column: `createdAt` is `TEXT` (ISO string like `2026-05-09T...`), but `onboarding_completed_at` is `INTEGER` (unix-ms per `complete-onboarding-action.ts:41`). Inserting an ISO string into an INTEGER column stores it as TEXT (SQLite type affinity), creating a heterogeneous column. Subsequent reads compare INTEGER timestamps to ISO strings — undefined behavior.

**Fix:**
```sql
UPDATE user_profiles
SET onboarding_completed_at = (strftime('%s','now') * 1000)  -- unix-ms, matches new writes
WHERE onboarding_completed_at IS NULL
  AND user_id IN (SELECT user_id FROM user_tiers WHERE tier = 'MASTER');
```

Or stamp `0` if "first MASTER user pre-Wave-16" semantics matter — the value just needs to be non-null. Don't try to faithfully reconstruct join times; the dashboard redirect only checks `IS NULL`.

---

### C4. i18n keys missing in BOTH en.json and vi.json — render-progress will display raw key strings
**Files:** `messages/en.json`, `messages/vi.json`, used by `render-progress.tsx:143`

`RenderProgress` calls `t(\`steps.${step as StepKey}\`)` for steps `parse, tts, video, poll, download, mux, done`. Existing `dashboard.videos.steps` namespace contains only `{script, assets, render}` (verified by inspection). All 7 new keys are missing in BOTH locales.

Effect: progress UI shows raw strings like `dashboard.videos.steps.tts` to users instead of "Generating speech…". Direct violation of the i18n SYNC PROTOCOL (Rule 8 in user CLAUDE.md).

**Fix:** Add to both `messages/en.json` and `messages/vi.json` under `dashboard.videos.steps`:
```json
"steps": {
  "script": "Script", "assets": "Assets", "render": "Render",   // keep existing
  "parse": "Parsing prompt",
  "tts": "Generating voiceover",
  "video": "Generating video",
  "poll": "Waiting for render",
  "download": "Downloading clips",
  "mux": "Mixing audio + video",
  "done": "Complete"
}
```
And the Vietnamese counterparts. Add a snapshot test that asserts every `t('dashboard.videos.steps.X')` resolves in both locales (ref: Rule 8 verification snippet).

---

## Major (fix soon)

### M1. Action does not release quota on downstream failures
**File:** `src/app/actions/video-generate-action.ts:62-95`

`reserveVideoSlot` increments the monthly counter atomically. If the subsequent `INSERT engine_missions` (C1) or `inngest.send` throws, the slot stays consumed. User loses a credit for nothing.

**Fix:** Wrap insert + emit in try/catch; on failure call a `releaseVideoSlot` helper (or compensating decrement) and return error. Even simpler: do the quota reservation last, after insert+emit succeed (less atomic but recoverable).

### M2. Inngest emit ordering — event sent before D1 commit confirmation
**File:** `src/app/actions/video-generate-action.ts:78-95`

`db.from(...).insert(...)` returns `{data, error}` but the action `await`s without checking `error`. Even if column shape were correct (C1), a transient D1 error would proceed to `emitVideoGenerate` and worker would race against a non-existent row.

**Fix:**
```ts
const { error } = await db.from('engine_missions').insert({...}) as { error: { message: string } | null };
if (error) {
  // release quota, return failure
  return { success: false, error: 'Failed to create mission', code: 'DB_ERROR' };
}
await emitVideoGenerate(...);
```

### M3. `RenderProgress` `useEffect` deps lint-disabled — `status` reads stale value in `onerror`
**File:** `render-progress.tsx:81-92`

`es.onerror` closes over `status` from initial render (= `'pending'`). The `eslint-disable-next-line` masks this. Effect: error handler never closes the stream because `status` is never re-read after initial mount.

**Fix:** Use a ref for status, or move the close logic into the `addEventListener` terminal handlers (already correctly done there, so the onerror branch is partially dead code anyway — simplest fix: remove the `if (status === ...)` guard inside `onerror` and rely on EventSource auto-reconnect).

### M4. `complete-onboarding-action` ignores DB write errors silently
**File:** `src/app/actions/complete-onboarding-action.ts:43-57`

`db.from('user_profiles').update(...)` returns `{data, error}`; action only catches thrown exceptions. The query builder swallows D1 errors into the `error` field (no throw). Result: silent no-op, action returns `{success: true}`, user redirected, but `onboarding_completed_at` never set → next visit redirects them BACK to /onboarding → loop.

**Fix:** Inspect `error` field after update.

### M5. `OnboardingPage` calls server action then `redirect` — works, but `revalidatePath` already triggers re-render
**File:** `src/app/[locale]/dashboard/onboarding/page.tsx:96-104`

Calling `completeOnboardingAction` inside a server component then `redirect('/dashboard')` is fine, but minor: the action also does `revalidatePath('/dashboard')` which is wasted (we redirect immediately). Not a bug, just trivia.

### M6. `validateMissionApiKey` cast hides type error
**File:** `src/forest/missions/api-key-auth.ts:51`

```ts
.single() as { data: ApiKeyRow | null; error: unknown };
```
Pre-existing, but the destructure of `data` without checking `error` (line 53) means a transient DB error returns `{valid:false, error:'Invalid API key'}` — wrong error message for users. Out of Wave-16 scope but flag for hardening.

---

## Minor (nice-to-have)

- `emit-video-generate.ts:25` — `EmitVideoGenerateInput` is exported but the `language` default `'en'` in `emit-video-generate.ts:32` overrides any explicitly-passed `undefined`; OK but consider using strict type `NonNullable<...>` to make caller intent clearer.
- `ai-prompt-form.tsx:43-55` — `handleSubmit` does not protect against double-submit if user spams the button before `setIsPending` resolves; `disabled={isPending}` mostly covers it but a request-id guard is more robust.
- `ai-prompt-form.tsx:64-72` — when `missionId` set, no way to dismiss/start-over without retry. UX nit.
- `install-starter-sop.ts:62-73` — `INSERT OR IGNORE` is a no-op here because table has no UNIQUE(user_id, template_id) constraint (`migrations/0056-sop-installations.sql:4-16`). The `alreadyInstalled` check is your real idempotency. Either add the UNIQUE index, or drop "OR IGNORE" since it's misleading.
- `video-generation-starter.ts:21-41` — `agentsYaml` references tools `ai:write`, `video:create`, `social:publish`. Verify these tool slugs match the executor registry; if not, the playbook fails first run (silently from user POV).
- `dashboard/page.tsx:72-74` — MASTER redirect happens BEFORE `Promise.all` for sopCount/recentRuns/etc, which is good (saves work) but the `[profileResult, tier, balance]` query already runs before the redirect — fine for now, mention because future cost optimization.
- `render-progress.tsx:31-39` — `STEP_ORDER` includes `done` as a step. When status is succeeded, the component returns `<VideoPlayer>` early so `done` is never rendered as a step row. Dead value in array.
- `complete-onboarding-action.ts:19-22` — `reason` field is documented as "for telemetry; not stored" but no telemetry log call exists. Either log it or delete the field (YAGNI).
- `auto-handover.ts:154-159` — `installStarterSop(...).catch(...)` is non-blocking; logs `String(err)` instead of using the project's `getErrorMessage(err)` helper used elsewhere in same file. Inconsistent.
- `onboarding/page.tsx:86-92` — `loadStepStatus` query joins `publishing_channels` and `telegram_paired_chats` via UNION ALL with LIMIT 1. The `LIMIT 1` likely binds to the second SELECT only (parser order), not the union — verify intent.
- `ai-prompt-form.tsx:30` — `serverError` is set but never cleared on retry success; if user retries after error, then succeeds, then hits an unrelated error path, stale text could appear. Minor.

---

## Strengths

- Clean Zod schema in `videoGenerateSchema` with min/max bounds.
- Auth gate in both server actions (`getCurrentUser()` first), userId always derived from session, never from input.
- Layer architecture respected: `forest/missions/emit-video-generate.ts` imports only `forest/inngest` + `lib/video/types`. `tree/handover/install-starter-sop.ts` imports only `seed/utils`. No banned cross-layer leaks.
- Idempotency thinking present in `install-starter-sop` (`alreadyInstalled` check + skip-if-template-not-seeded).
- `auto-handover.ts:155-158` correctly calls `installStarterSop` non-blockingly with `.catch` — payment flow won't fail if SOP install errors.
- All canonical aliases used (`@/seed/auth/better-auth-session`, `@/seed/db/client`, `@/seed/config/tiers`). No banned imports (`@/lib/auth`, `@/lib/subscription`, etc.). No Polar.sh references.
- `createServerClient()` used synchronously throughout — no incorrect awaits.
- Zero `:any` in reviewed files.
- Components correctly split client/server (`'use client'` directives sound).
- File-size discipline: every file <200 LOC.
- Migration 0098 has correct guard (`WHERE onboarding_completed_at IS NULL`) — re-runnable.
- `OnboardingSteps` refactored to client correctly to use `useTranslations` hook.

---

## Unresolved questions

1. Are the `engine_missions` columns `tenant_id` / `input` planned for a separate migration that hasn't landed yet? If yes, where, and what's the ordering vs the action deploy? If no, schema needs to change OR action needs to use `params`.
2. Is there a deliberate plan to introduce cookie-session auth on the `/api/v1/missions/[id]/stream` route (non-trivial — that route is also consumed by external API clients)? Or should the dashboard use a separate route?
3. The `emit-video-generate` helper is in `forest/missions/` but `forest/missions/` previously only contained API-key auth. Should there be a barrel `forest/missions/index.ts` per the layer rules section "Public API per domain"?
4. Migration 0098 was tested how? Apply on a fresh local D1 + observe `error: no such column`? Tester reported all green — was migration apply actually tested or just the in-memory unit tests?
5. `RenderProgress` uses `STEP_ORDER` derived from worker step names — but actual worker step names (`generate-audio`, `submit-wan`, `poll-wan`, `download-mux`, `update-mission`, etc. per `forest/inngest/functions/video-generate.ts`) don't obviously map to `parse/tts/video/poll/download/mux/done`. How does the worker's `step` field get populated to drive the UI? (Couldn't find a write of `step` column or event payload.)
