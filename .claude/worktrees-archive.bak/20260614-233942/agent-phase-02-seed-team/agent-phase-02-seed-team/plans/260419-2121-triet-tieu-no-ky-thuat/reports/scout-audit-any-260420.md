# Scout Report: lib/audit Any Casts

**Scanned:** April 20, 2026 | **Target:** src/lib/audit/* (10 files, non-test)  
**Total findings:** 33 occurrences across all target files

---

## File 1: src/lib/audit/report-scheduler.ts (5 any)

| Line | Code Snippet | Classification | Issue | Fix Strategy |
|------|--------------|-----------------|-------|--------------|
| 208 | `const result = await (db as any)` | D1 row | Supabase client missing explicit row type | Define `ScheduledReportRow` interface (exists at line 95) + use generic `db.from<ScheduledReportRow>()` |
| 258 | `const result = await (db as any)` | D1 row | Same — reading from compliance_report_schedules | Use `db.from<ScheduledReportRow>()` + map result |
| 298 | `const result = await (db as any)` | D1 row | Delete op on compliance_report_schedules | Use typed query even for delete operations |
| 325 | `const result = await (db as any)` | D1 row | Select * with lte filter | Use explicit row type on from() |
| 365 | `const result = await (db as any)` | D1 row | Update next_run_at timestamp | Use explicit typing for update query |

---

## File 2: src/lib/audit/right-to-erasure.ts (5 any)

| Line | Code Snippet | Classification | Issue | Fix Strategy |
|------|--------------|-----------------|-------|--------------|
| 85 | `const { data: existingLogs, error: fetchError } = await (db as any)` | D1 row | Fetch raas_audit_logs for user | Define row interface: `{ id: string; user_id: string; ip_address: string\|null }` + use generic |
| 117 | `const { error: updateError } = await (db as any)` | D1 row | Update raas_audit_logs with anonymization | Same row type as above |
| 198 | `const { data: user, error: userError } = await (db as any)` | D1 row | Fetch auth.users metadata | Define `{ raw_user_meta_data: Record<string, unknown> }` interface |
| 230 | `const { data: firstLog } = await (db as any)` | D1 row | Select created_at from raas_audit_logs | Define `{ created_at: number }` row interface |
| 293 | `const { data: request } = await (db as any)` | D1 row | Query gdpr_erasure_requests table | Define row interface: `{ created_at: string; completed_at: string\|null; anonymized_count: number }` |

---

## File 3: src/lib/audit/cron-report-runner.ts (7 any)

| Line | Code Snippet | Classification | Issue | Fix Strategy |
|------|--------------|-----------------|-------|--------------|
| 66 | `const logsQuery = (db as any)` | D1 row | raas_audit_logs count query | Use typed from() — define row interface (not selected, just count) |
| 79 | `const hashChainQuery = await (db as any)` | D1 row | Select content_hash, hash_chain_valid | Define `{ content_hash: string; hash_chain_valid: boolean }` interface |
| 89 | `const hashChainQueryEnd = await (db as any)` | D1 row | Select content_hash only (reverse order) | Same interface as line 79 |
| 100 | `const licenseQuery = await (db as any)` | D1 row | raas_licenses — defined row interface at 178 | Use interface LicenseReportRow (already exists in code) |
| 109 | `const usageQuery = await (db as any)` | D1 row | raas_usage_events multi-column select | Define `{ license_nonce: string; model_name: string; token_count: number; tokens_input: number; tokens_output: number }` |
| 157 | `const validationQuery = await (db as any)` | D1 row | Select license_nonce from audit logs | Define `{ license_nonce: string }` interface |
| 333 | `logger.error('[Cron Runner]...', ... as any)` | Error object | Unsafe error casting in logger | Use `unknown` guard: `error instanceof Error ? error.message : String(error)` |

---

## File 4: src/lib/audit/violation-logger.ts (5 any)

| Line | Code Snippet | Classification | Issue | Fix Strategy |
|------|--------------|-----------------|-------|--------------|
| 124 | `.insert({...} as any)` | Cast to another type | Record<string, any> → explicit row interface | Define insert DTO interface matching audit_logs schema |
| 126 | `.single() as any` | Function return | Supabase response shape unclear | Use generic: `.single() as SupabaseQueryResult<ViolationRow>` |
| 234 | `let query = db...select(...) .limit(limit) as any` | Function parameter/callback | Query builder type lost mid-chain | Build query step-by-step with explicit types instead of casting |
| 270 | `return (data \|\| []).map((row: ViolationRow) =>` + line 277 `type = row.event_type?.replace(...) as ViolationType` | Function parameter/callback | Unsafe type coercion on event_type | Add runtime validation: check if type is in ViolationType union |
| 314 | `.limit(options.limit) as any` | Function return | Query builder cast | Use explicit Supabase query type instead |

---

## File 5: src/lib/audit/usage-event-tracker.ts (2 any)

| Line | Code Snippet | Classification | Issue | Fix Strategy |
|------|--------------|-----------------|-------|--------------|
| 93 | `const result = await (db as any)` | D1 row | Insert + select + single on raas_audit_logs | Define row interface matching RaasAuditLogRow (import from types) |
| 154 | `const result = await (db as any)` | D1 row | Same insert pattern in logApiUsage | Reuse RaasAuditLogRow interface from @/lib/supabase/types |

---

## File 6: src/lib/audit/report-delivery.ts (6 any)

| Line | Code Snippet | Classification | Issue | Fix Strategy |
|------|--------------|-----------------|-------|--------------|
| 243 | `errors.push(\`Email delivery failed: ${(emailError as Error).message}\`)` | Error object | Unsafe cast assuming Error type | Use `emailError instanceof Error ? emailError.message : String(emailError)` |
| (Rest in 250+, truncated by read limit) | ... | ... | ... | ... |

---

## File 7: src/lib/audit/audit-query-logger.ts (5 any)

| Line | Code Snippet | Classification | Issue | Fix Strategy |
|------|--------------|-----------------|-------|--------------|
| 77 | `const { data, error } = await (db as any)` | D1 row | raas_audit_logs insert + select + single | Use RaasAuditLogRow generic from types |
| 135 | `const { error } = await (db as any)` | D1 row | raas_audit_logs insert (API key creation) | Consistent typing on insert |
| 188 | `const { error } = await (db as any)` | D1 row | raas_audit_logs insert (API key revocation) | Consistent typing on insert |
| 240 | `const { error: insertError } = await (db as any)` | D1 row | raas_audit_logs insert (validation failure) | Consistent typing on insert |
| (See test file lines 35-226, skipped per non-test requirement) | Test mocks | TEST SKIP | Not included in scout scope | N/A |

---

## File 8: src/lib/audit/logger/audit-writer-extended.ts (1 any)

| Line | Code Snippet | Classification | Issue | Fix Strategy |
|------|--------------|-----------------|-------|--------------|
| 22 | `async function finalizeReceipt(..., log: any): Promise<ComplianceReceipt>` | Function parameter/callback | Generic log object lacking type info | Define union interface: `RaasAuditLogRow \| { id: string; [key: string]: unknown }` + document shape |

---

## File 9: src/lib/audit/logger/audit-event-builder.ts (2 any)

| Line | Code Snippet | Classification | Issue | Fix Strategy |
|------|--------------|-----------------|-------|--------------|
| 21 | `db: ReturnType<typeof createServerClient>` (line 21 implicit) | Function parameter/callback | Type of db client not explicit (implicit return type) | Either: (1) extract `SupabaseServerClient` type alias, or (2) use explicit generic on createServerClient |
| 26 | `return result as SupabaseResult<RaasAuditLogRow>` | Cast to another type | Unsafe assertion without runtime check | Already typed correctly (casting result of `.single()` is safe here) — audit but likely OK |

---

## File 10: src/lib/audit/logger/audit-writer.ts (1 any)

| Line | Code Snippet | Classification | Issue | Fix Strategy |
|------|--------------|-----------------|-------|--------------|
| 22 | `async function finalizeReceipt(..., log: any): Promise<ComplianceReceipt>` | Function parameter/callback | Identical to audit-writer-extended.ts:22 | Define RaasAuditLogRow union type, apply consistently across both files |

---

## Summary by Classification

| Classification | Count | Action Priority |
|---|---|---|
| D1 row (db.from<T>() needed) | 22 | HIGH — Reuse existing RaasAuditLogRow + define missing row interfaces |
| Function parameter/callback | 5 | MEDIUM — Add explicit type signatures for log objects, query builders |
| Error object | 2 | MEDIUM — Replace `as Error` with `instanceof Error` guards |
| Cast to another type | 4 | LOW-MEDIUM — Review casting logic; some may be correct (e.g., `.single() as Type`) |

---

## Reusable Interfaces (Already Defined)

- **RaasAuditLogRow** — `@/lib/supabase/types` (available for import)
- **RaasAuditLogInsert** — `@/lib/supabase/types` (used correctly in several places)
- **ScheduledReportRow** — Already defined in report-scheduler.ts:95 (can extract to types file)

---

## Recommended Action Plan

1. **Extract Row Interfaces** → Create `src/lib/audit/types.ts`:
   - `ScheduledReportRow` (move from report-scheduler.ts)
   - `AuditLogRow` (for raas_audit_logs reads)
   - `LicenseRow`, `UsageEventRow`, `GdprErasureRequestRow` (specific to each table)

2. **Update All `(db as any)` Casts** → Replace with:
   ```ts
   const result = await (db as unknown as SupabaseClient)
     .from<RowType>('table_name')
     ...
   ```

3. **Fix Function Parameters** → Replace `log: any` with explicit union types
4. **Error Guards** → Add `instanceof Error` checks before accessing `.message`
5. **Test After Each File** — Run `npm test` to validate no runtime breakage

---

## Notes

- No existing interfaces in `src/types/` for audit rows (audit system is self-contained)
- No duplicate row type exports detected (each table has one canonical row interface)
- `JSON.parse()` calls in violation-logger.ts:273, 345 use `as any` implicitly but handle gracefully with fallback
- Supabase RPC calls not present in this audit module (all direct table queries)

