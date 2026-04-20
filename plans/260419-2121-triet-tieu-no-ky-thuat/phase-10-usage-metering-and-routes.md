# Phase 10 — Usage Metering + Route Handlers `:any` Cleanup

**Status:** ✅ COMPLETE (2026-04-20)
**Priority:** P2 (Tech-debt elimination — Phase 9 follow-up)
**Session:** `/cook next --auto Phase 10`

## Scope

### `lib/usage-metering/*` + 2 route handlers — 20 occurrences across 8 files

Scout report: `reports/scout-usage-metering-any-260420.md`

| File | Count | Shape |
|---|---|---|
| `src/lib/usage-metering/rollup/hourly-rollup.ts` | 3 | D1 RPC + JSON column + double-cast + error |
| `src/lib/usage-metering/rollup/daily-rollup.ts` | 4 | D1 RPC + JSON read + JSON insert + error |
| `src/lib/usage-metering/usage-kv-sync.ts` | 3 | D1 license + insert + client cast |
| `src/lib/usage-metering/export.ts` | 2 | Query response + CSV function param |
| `src/lib/usage-metering/tracker.ts` | 2 | D1 metadata + data extraction |
| `src/lib/usage-metering/usage-rollup-engine.ts` | 4 | 3× query chain + aggregated response |
| `src/app/api/v1/usage/batch/route.ts` | 1 | D1 api_key lookup |
| `src/app/api/admin/licenses/audit/route.ts` | 1 | getAuditLogs param cast |

## Approach

1. **Extend `src/lib/usage-metering/types.ts`:**
   - `UsageEventInsertable` — full D1 `usage_events` insert schema
   - `D1Response<T>` generic `{ data: T | null; error: unknown }`
   - `LicenseLookupRow` — for api_key + license joins in route handlers
2. **Reuse D1 typed shim** — `db.from<RowType>('table')` when possible. Fall back to `as unknown as D1Response<T>` only for RPC chains.
3. **JSON column safety** — replace `as any` reads with `Array.isArray()` validation before casting to `ServiceBreakdownItem[]`.
4. **Remove double-casts** — `} as any) as any` → type the insert payload properly; the D1 shim accepts `Record<string, unknown>`.
5. **Error handling** — `throw error as any` → `throw error instanceof Error ? error : new Error(String(error))`.
6. **Route handlers** — define `GetAuditLogsParams` interface at top of `audit/route.ts`; type the api_key lookup in `batch/route.ts`.
7. **tracker.ts:L146** — replace `(data as { id: string }).id` with proper runtime guard (`typeof data === 'object' && 'id' in data`).

## Non-Goals

- Test file `:any` — mocks (legitimate)
- `lib/raas*` — deferred to Phase 11+ (live license system, careful scope)
- Bulk audit of `raas_licenses` D1-vs-Supabase migration — design discussion required
- FSM self-heal write-back — design discussion required
- Untracked coupon routes WIP — needs user decision
- Untracked `apps/sophia-proposal/wrangler.toml` — separate app

## Files to Edit

- `src/lib/usage-metering/types.ts` (extend with new interfaces)
- `src/lib/usage-metering/rollup/hourly-rollup.ts`
- `src/lib/usage-metering/rollup/daily-rollup.ts`
- `src/lib/usage-metering/usage-kv-sync.ts`
- `src/lib/usage-metering/export.ts`
- `src/lib/usage-metering/tracker.ts`
- `src/lib/usage-metering/usage-rollup-engine.ts`
- `src/app/api/v1/usage/batch/route.ts`
- `src/app/api/admin/licenses/audit/route.ts`

## Success Criteria

- [x] Build: 0 TS errors
- [x] Tests: 1297/1297 pass (31 skipped OK; no regressions)
- [x] Lint: 0 errors on edited files
- [x] `lib/usage-metering/*` + 2 routes non-test `:any` count: 20 → 0
- [x] Code review: score 9.6/10 APPROVE
- [ ] Production: HTTP 200 after push; CI/CD GREEN (pending)

## Results (2026-04-20)

**Completed:** 9 files edited. All success criteria except production push met.

| File | Changes |
|---|---|
| `src/lib/usage-metering/types.ts` | Extended with 4 new interfaces: `D1Response<T>`, `UsageEventInsertable`, `LicenseMetadataRow`, `ApiKeyRecord` |
| `src/lib/usage-metering/rollup/hourly-rollup.ts` | 3 `:any` → 0; JSON validation + D1Response typing |
| `src/lib/usage-metering/rollup/daily-rollup.ts` | 4 `:any` → 0; JSON col reads + insert payload typing |
| `src/lib/usage-metering/usage-kv-sync.ts` | 3 `:any` → 0; D1 license lookup + insert client cast |
| `src/lib/usage-metering/export.ts` | 2 `:any` → 0; service_name→featureKey (bug fix); CSV param typing |
| `src/lib/usage-metering/tracker.ts` | 2 `:any` → 0; error.details→error.message (bug fix); metadata typing |
| `src/lib/usage-metering/usage-rollup-engine.ts` | 4 `:any` → 0; query chain + aggregated response D1 typing |
| `src/app/api/v1/usage/batch/route.ts` | 1 `:any` → 0; api_key lookup interface |
| `src/app/api/admin/licenses/audit/route.ts` | 1 `:any` → 0; GetAuditLogsParams interface |

**Metrics:**
- ✅ **`:any` Elimination:** 20 → 0 (100%)
- ✅ **Build:** 0 TS errors (tested locally)
- ✅ **Tests:** 1297/1297 (100% maintained; 31 skipped = fixtures, legitimate)
- ✅ **Lint:** 0 errors on scope
- ✅ **Code Review:** 9.6/10 auto-approve (excellent)
- 🟡 **Incidental Fixes:** 2 pre-existing bugs corrected (service_name, error.message)
- 🟡 **Nits Deferred:** 6 minor optimizations to Phase 11+ (D1Response promotion, types.ts split @288L, etc.)

## Risk Assessment

- **Low-medium risk:** Rollup engines are hot paths (hourly/daily cron). Type-only refactor preserves behavior, but JSON column validation changes read semantics slightly — verify test coverage exercises these reads.
- **Route handlers:** Zod already validates inputs; typing D1 responses is additive safety.
- **Shared types.ts:** Extension, not rewrite — no import cycles expected.

## Deferred (Phase 11+ backlog)

1. FSM self-heal write-back strategy (design discussion)
2. `lib/raas*` + `lib/raas-gateway-enhanced.ts` (live license system)
3. `raas_licenses` D1-vs-Supabase migration audit
4. Audit tests `:any` (legitimate mocks — only clean if pattern emerges)
5. `src/lib/audit/gdpr-redaction.ts`, `pdf-report-generator.ts`, `audit-hashing.ts` — scout Phase 9 noted these as clean but re-verify
6. `insertTyped<T>()` helper in `@/lib/db/helpers` to reduce `as unknown as Record<string, unknown>` boilerplate
7. `ClientWithStorage` shim in `report-delivery.ts` — runtime bug (D1 has no Storage; migrate to R2)
8. Untracked coupon routes WIP — user decision
9. Untracked `apps/sophia-proposal/wrangler.toml`
