# Policy Violations Report — 02-policy-violations

Date: 2026-07-17
Auditor: workflow-subagent (kongming-actions chain)

---

## 1. Critical Violations Count

**0 critical violations detected.**

---

## 2. Checks Performed

| Check | Result |
|-------|--------|
| `grep -rl "@polar-sh"` in `src/**/*.ts(x)` | No results |
| `grep -rl "@supabase"` in `src/**/*.ts(x)` | No results |
| `grep -rl "@supabase"` in `src/app/**/*.ts(x)` | No results — no route handlers directly import @supabase |
| `package.json` scan for `@polar-sh` / `@supabase` | No results for either |

---

## 3. @polar-sh Assessment

**Status: CLEAN.** The `@polar-sh/sdk` package and all Polar references have beenfully removed from the codebase. Zero violations.

---

## 4. @supabase Assessment

No direct `@supabase/gotrue`, `@supabase/postgrest`, or `@supabase/auth-js` runtime imports exist in `src/`. The 21 files containing "supabase" fall into four categories:

### Category A — D1-backed replacements (formerly Supabase modules)
These files replaced deleted Supabase client code with D1-backed shims that preserve the old API surface:
- `src/land/supabase/admin.ts` — Supabase admin client replaced by `createServerClient()` (D1). Documented as drop-in replacement.
- `src/land/supabase/sophia-index.ts` — Sophia Index rebuilt on D1Client. Documented as drop-in replacement.

**Verdict: Clean.** These are migration artifacts preserving backward compatibility for callers. They use D1, not Supabase, at runtime.

### Category B — Type-only imports from deprecated `@/tree/database/supabase-types`
Files importing `type { ... }` from a deprecated type definition shim:
- `src/land/ingestion/base-adapter.ts` (type-only)
- `src/land/intelligence/runner.ts` (type-only)
- `src/land/intelligence2/runner.ts` (type-only)
- `src/land/usage-export/export-service-query.ts` (type-only)
- `src/land/usage-export/types.ts` (type-only)
- `src/app/api/admin/usage/customer-linkage/route.ts` (type-only — `RaasLicenseUpdate`)
- `src/land/alerts/alert-threshold-utils.ts` (imports via consumer)

**Verdict: Clean.** These are `import type` statements pulling generated types from a deprecated shim file. No Supabase client instantiation. The shim file (`src/tree/database/supabase-types.ts`) is marked "DEPRECATED — maintained for backward compatibility." Migration path exists (`@/seed/types/<domain>`), but usage is currently within policy.

### Category C — String mentions only (no imports)
- `src/land/tenant-settings/__tests__/export-import-roundtrip.test.ts` — test fixture string `'supabase'`
- `src/land/affiliates/video-description-injector.ts` — comment mentions "supabase-shim" scenarios
- `src/forest/raas-schema.ts` — "supabase" in MCP tool whitelist string
- `src/land/openclaw/mcp-gateway.ts` — "supabase" in MCP whitelist string
- `src/forest/raas-schema.ts`, `src/land/openclaw/mcp-gateway.ts`, `src/land/admin/supabase-migrations-manifest.ts` — admin-side migration tracking
- Analytics queries (`revenue-queries.ts`, `campaign-queries.ts`, `roi-calculator.ts`) — "supabase" in contextual code paths, not imports
- `src/land/billing/nowpayments-ipn-dead-letter.ts` — no actual supabase interaction

**Verdict: Clean.**

### Category D — Supabase-related config files (outside src/)
- `src/land/admin/supabase-migrations-manifest.ts` — manifest file tracking migration history. Customer-side admin tooling.

**Verdict: Clean.** Not a Supabase client usage.

---

## 5. Files to Fix

**None require immediate remediation.** No critical, high, or medium violations found.

Files to clean up opportunistically (low priority, follow-up work):
1. `src/land/supabase/admin.ts` — can be deleted once all callers migrate directly to `createServerClient()`
2. `src/land/supabase/sophia-index.ts` — can be deleted once all callers consume `sophiaIndex` directly
3. `src/tree/database/supabase-types.ts` — can be deleted once all type imports migrate to `@/seed/types/<domain>`
4. All 7 files in Category B — migrate type imports from `@/tree/database/supabase-types` to `@/seed/types/<domain>`

---

## 6. Recommended Actions

| # | Action | Priority | Effort |
|---|--------|----------|--------|
| 1 | **No immediate action required** — no policy violations found. | — | — |
| 2 | Migrate 7 files in Category B from `@/tree/database/supabase-types` to `@/seed/types/<domain>` aliases. | Low | 2-3 hours |
| 3 | Audit callers of `createAdminClient()`, `isAdminClientConfigured()`, and `isSupabaseConfigured` to inline D1 calls and delete `src/land/supabase/admin.ts`. | Low | 1-2 hours |
| 4 | Audit callers of `sophiaIndex` to inline or consolidate, then delete `src/land/supabase/sophia-index.ts`. | Low | 1 hour |
| 5 | Verify `@/tree/database/supabase-types.ts` has no remaining callers, then delete. | Low | 15 min |
| 6 | Confirm in package-lock / node_modules that `@supabase` packages are absent (not just src/). Run `grep "@supabase" package.json package-lock.json` for certainty. | Informational | 5 min |

---

## Summary

- **@polar-sh violations:** 0 (Polar fully purged)
- **@supabase client violations:** 0 (no runtime Supabase client imports; all references are D1-backed shims or type-only imports)
- **Supabase policy compliance:** Compliant — Supabase code exists only as backward-compatible D1 migration artifacts, matching the documented "OAuth callbacks and legacy shared flows only" exception scope
- **Overall status:** CLEAN — no policy violations blocking deploy or merge

**Unresolved Qs:**
- Type-only imports from `supabase-types.ts` are technically deprecated but not policy-breaking. Should the team schedule a cleanup sprint to eliminate the shim entirely?
- The `MCP_WHITELIST` containing `'supabase'` (in `raas-schema.ts` and `mcp-gateway.ts`) references a tool whitelist key, not a Supabase client usage. Should this key be renamed to avoid confusion?

Status: DONE
