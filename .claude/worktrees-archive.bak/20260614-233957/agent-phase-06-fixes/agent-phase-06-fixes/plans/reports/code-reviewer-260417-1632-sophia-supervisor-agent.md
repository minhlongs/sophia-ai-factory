# Code Review — Sophia Supervisor Agent MVP

## Summary
- **Score: 6.5/10** (below 9.5 auto-approve threshold)
- **Critical: 2** — schema mismatch + broken SSR auth
- **High: 4** — missing timestamps, actor convention, step error swallow, duplicate events
- **Medium: 3** — prompt sanitisation, TEXT sort, multi-org arbitrary pick
- Do **NOT** merge until Critical + High issues below are fixed.

---

## Critical

### C1. `createWorkflow` INSERTs non-existent columns — runtime failure
**File:** `src/lib/db/workflow-repository.ts:88-104`

The INSERT statement binds `mcu_cost, mcu_reserved, max_retries, retry_count, is_sub_mission, execution_log` — but the `missions` table schema (`0001-init.sql:80-98`) contains only: `id, org_id, title, command, params, priority, status, result, error_message, mcu_cost, mcu_reserved, webhook_url, parent_mission_id, started_at, completed_at, created_at, updated_at`.

`max_retries`, `retry_count`, `is_sub_mission`, `execution_log` **do not exist in any migration 0001-0007**. POST /api/raas/workflows will hit D1 and throw `SQLITE_ERROR: no such column`. Entire feature is DOA against production DB.

**Fix:** Remove the four non-existent columns. Use:
```sql
INSERT INTO missions (id, org_id, title, command, params, status, parent_mission_id, created_at, updated_at)
VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
```
Tests passed because Vitest mocks/D1 local schema probably wasn't rebuilt. Run `wrangler d1 migrations apply DB --local` + an integration test that actually inserts.

### C2. SSR workflow detail fetch is unauthenticated → always renders "not found"
**File:** `src/app/[locale]/dashboard/workflows/[id]/page.tsx:61-67`

```ts
const res = await fetch(`${baseUrl}/api/raas/workflows/${id}`, {
  cache: 'no-store',
  headers: { cookie: '' }, // session forwarded via runtime context on CF Workers
})
```
Sending an explicit empty `cookie` header strips the session — the API route returns 401, `workflow` stays `null`, user always sees not-found state on first paint. The comment is wishful thinking. CF Workers do not forward runtime session via `fetch(baseUrl, …)`.

**Fix:** Query `getWorkflow(id, orgId)` directly server-side (skip the HTTP round-trip), same as the GET route does. Or forward `(await headers()).get('cookie')` into the fetch.

---

## High

### H1. Missing actor convention — cron events use org_id as actor
**File:** `src/app/api/cron/workflow-stepper/route.ts:68, 126, 140`

Review prompt explicitly required `actor=workflow_id` for cron-initiated (per commit 17f33c1c Phase F). Current code passes `workflow.org_id` as the 2nd arg to `track()` — the `actor` slot. That puts org ids in the `actor` column (mixed with user ids from elsewhere, breaking actor = users.id queries). For user-initiated POST (`route.ts:83`) `user.id` is correctly used.

**Fix:** Use `workflow.id` for cron-initiated events and move `org_id` into the 4th arg (`orgId`), plus add `source:'cron'` into props to match local-mode-health pattern:
```ts
track(D1Events.WORKFLOW_STEP_COMPLETED, workflow.id, {
  workflow_id: workflow.id, step_order, step_type, source: 'cron',
}, workflow.org_id)
```

### H2. `executeStep` never writes `started_at` / `completed_at`
**File:** `src/app/api/cron/workflow-stepper/route.ts:56-66`

The two UPDATEs set `status` + `updated_at` only. The missions table has dedicated `started_at` and `completed_at` columns — they stay NULL forever. Detail page pulls these via `params.started_at/completed_at` (detail page line 95-96), which also never populates since params JSON isn't rewritten. Timeline UI will never show the "Started / Done" row.

**Fix:** Add `started_at=?` to the first UPDATE, `completed_at=?` to the second. Select them in `getWorkflow`, return at the top level (not nested in params).

### H3. `executeStep` has no try/catch → cron aborts mid-sequence, workflow stuck
**File:** `src/app/api/cron/workflow-stepper/route.ts:37-73`

If either UPDATE throws (e.g. D1 transient), the throw bubbles up to `advanceOne`'s caller, the `for (const wf of active)` loop's catch logs `'advanceOne failed'` — but the mission is now in an intermediate state (`running` without `completed`) and next cron tick sees no `queued` mission (was flipped to running), no `completed` priors to unblock. Workflow hangs indefinitely with no `failed` marker.

**Fix:** Wrap executeStep body in try/catch; on error do `UPDATE missions SET status='failed', error_message=? WHERE id=? AND status='running'` + `UPDATE workflows SET status='failed' …`. Emit WORKFLOW_FAILED.

### H4. Duplicate WORKFLOW_STEP_COMPLETED on cron re-run
**File:** `src/app/api/cron/workflow-stepper/route.ts:61-72`

CAS `status='running' WHERE status='queued'` succeeds first cron, then immediate CAS `status='completed' WHERE status='running'` succeeds too — but `track()` fires unconditionally, even if both UPDATEs were no-ops on a second invocation (cron overlaps, clock drift). Plan doc says "events use `workflow_id + step_order` dedupe key" — not enforced anywhere. D1 `signals_events` has no UNIQUE (workflow_id, step_order).

**Fix:** Check `meta.changes` from D1 UPDATE result; only track if changes > 0. Or add partial unique index / skip emit on no-op.

---

## Medium

### M1. Prompt allows whitespace-only / no trim
**File:** `src/app/api/raas/workflows/route.ts:21-23`

`z.string().min(10).max(2000)` accepts `"          "` (10 spaces). Add `.trim().min(10)`.

### M2. Step ORDER BY uses TEXT sort on json_extract
**File:** `src/lib/db/workflow-repository.ts:151-153`, `workflow-stepper/route.ts:82`

`ORDER BY json_extract(params,'$.step_order') ASC` — `json_extract` returns an integer value here (since step_order is stored as a JSON number), so SQLite will sort numerically. OK for MVP but fragile: if someone stringifies `step_order` later, `"10" < "2"`. Cast: `CAST(json_extract(...) AS INTEGER)`.

### M3. `resolveOrgId` picks arbitrary first org with no ORDER BY
**File:** `src/app/api/raas/workflows/route.ts:40-44`, `[id]/route.ts:31-35`

`LIMIT 1` without `ORDER BY` — user in multiple orgs could hit a different org across calls. For MVP single-tenant OK, but the `[id]` route would 404 cross-org items the user legitimately owns via a different membership row. Add `ORDER BY created_at ASC` or resolve via session's current org.

---

## Recommended actions before merge
1. **C1** — Fix INSERT columns (5 min). Without this, nothing works in prod.
2. **C2** — Replace SSR fetch with direct `getWorkflow()` call (10 min).
3. **H1** — Correct `actor` argument in 3 `track()` calls, add `source:'cron'` (5 min).
4. **H2** — Write `started_at`/`completed_at` in executeStep + read them in getWorkflow (15 min).
5. **H3** — Wrap executeStep in try/catch, mark failed on throw (15 min).
6. **H4** — Guard `track()` on `meta.changes > 0` (5 min).

Mediums can ship in follow-up.

---

## Positive observations
- `computeNext` pure state-machine is well-structured, exhaustive switch, deterministic.
- Auth + org scoping on GET/POST correct; 404 unification prevents enumeration.
- Zod validation on POST input.
- Per-workflow try/catch in cron GET handler prevents blast radius.
- All files ≤200 LOC (repository exactly 199).
- Bilingual labels correctly centralised in `workflow-labels.ts`.
- Cron auth matches local-mode-health Bearer pattern.

---

## Unresolved questions
- Did any test actually hit D1 `missions` INSERT with the extra columns, or only the mocked `batch()`? If tests pass with C1 present, the test harness is bypassing the real schema.
- Plan said "events use `workflow_id + step_order` dedupe key" — where is this enforced? (H4).
- `missions.priority`, `webhook_url`, `mcu_cost` defaulted via SQL — intentional to skip binding them?
- PEV engine for `execute_development` step is stubbed (returns static string). Acceptable for MVP but note in changelog so users don't expect real code gen.
