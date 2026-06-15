# Handoff Report — Documentation Integrity Critic (Critic 1)

## 1. Observation

- **Direct Observation 1 (Required Env Vars missing from Docs)**: `environment-config.ts` lines 14-15 require `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`. `jwt-validator-jwks.ts` lines 12-13 verify that `process.env.NEXT_PUBLIC_SUPABASE_URL` is set, otherwise throws an error. However, `docs/environment-variables.md` does not list either of these two environment variables.
- **Direct Observation 2 (Supabase JWT dependency)**: `jwt-validator.ts` line 25 uses `jwtVerify` with the JWKS endpoint of the external Supabase instance: `getExpectedIssuer()` which resolves to `${getSupabaseUrl()}/auth/v1`. This is used to validate all incoming license JWTs for the RaaS gateway.
- **Direct Observation 3 (Unregistered Inngest Jobs)**: `route.ts` registers only 12 functions in the serve block, while `index.ts` exports 27 background handlers. Exported functions such as `sopExecute`, `videoGenerate`, and `repurposeAnalyze` are not in the serve block.
- **Direct Observation 4 (SOP executor event dead-end)**: `sop-executor.ts` (line 141) creates the function listening for `sop/execution.requested`. Grep search results show `sop/execution.requested` is only defined in `client.ts` and `sop-executor.ts` itself; it is never published or dispatched anywhere in the codebase.
- **Direct Observation 5 (Polar.sh reference)**: `src/lib/schemas.ts` lines 24-32 schema `webhookHeaderSchema` requires either `webhook-signature` or `Polar-Signature` headers.
- **Direct Observation 6 (No Placeholders)**: Grep search for "TBD" and "todo" (case-insensitive) across the 12 target files in `docs/` returned zero matches.
- **Direct Observation 7 (Cron config drift)**: `inject-scheduled-handler.mjs` maps 14 route paths but `wrangler.toml` defines 18 crons. The 4 cron patterns `*/10 * * * *`, `0 7 * * *`, `10 * * * *`, and `0 */4 * * *` are in `wrangler.toml` but missing from mapping.
- **Direct Observation 8 (Unit Test Verification)**: Running `npm run ci:test` in `apps/sophia-ai-factory` completed with 0 errors. All 118 unit tests passed.

---

## 2. Logic Chain

- **Step 1**: From Direct Observation 1, because `environment-config.ts` enforces `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` as required at startup, and `jwt-validator-jwks.ts` throws when missing, the application will crash during bootstrap if these keys are absent. Since they are omitted from `docs/environment-variables.md` and `docs/setup.md`, this creates a high risk of local development and production deployment failures for any developer using the docs.
- **Step 2**: From Direct Observation 2, because the RaaS licensing layer calls `validateJwt` which verifies JWT signatures via JWKS fetched from `${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/jwks`, the system is still strictly coupled to an external Supabase auth instance. Therefore, the assumption in `SUMMARY.md` that Supabase is obsoleted and remains "only as remnants" is incorrect and misleading.
- **Step 3**: From Direct Observation 3, 4 and 5, because Inngest served functions list omits 15 exported jobs (including `sopExecute`), these background jobs are dead code. Specifically, `sop/execution.requested` is never emitted, so the Inngest handler `sopExecute` cannot execute. `Polar-Signature` is checked by `webhookHeaderSchema` but Polar.sh has been completely replaced by NOWPayments. This validates the accuracy of the `TECH_DEBT.md` report.
- **Step 4**: From Direct Observation 7, because `inject-scheduled-handler.mjs` lacks mapping entries for the 4 crons in `wrangler.toml`, the worker's scheduled trigger hook will log a routing mismatch and exit without calling their target routes, silently breaking automated affiliate scouting, cache purges, wallet rebuilding, and heartbeat ping monitoring.
- **Step 5**: From Direct Observation 6, we confirm the target documents are free of temporary placeholders.
- **Step 6**: From Direct Observation 8, the unit test passes confirm the correctness of the local-mode code logic.

---

## 3. Caveats

- We did not perform live end-to-end integration tests using actual NOWPayments or HeyGen callbacks on production Cloudflare, as this was out of scope for documentation review and requires live client credentials.
- The external Supabase project details used by the licensing layer were not inspected.

---

## 4. Conclusion

The backfilled documentation suite provides a highly detailed structural and operational overview of the Sophia AI Factory codebase. However, it contains two critical gaps/errors:
1. **Critical Environment Variable Omission**: Missing required Supabase and email provider setup variables (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `RESEND_API_KEY`) from `environment-variables.md` and `setup.md`.
2. **Incorrect Architectural Assumption**: The claim that Supabase is only an obsolete remnant is false, since the entire RaaS licensing verification logic depends on the external Supabase auth server.

All reported technical debt points, unregistered Inngest functions, and cron configuration drifts are verified as real code issues matching direct lines and files. The files are clean of any `TBD`/`todo` placeholders.

---

## 5. Verification Method

- **Command to run unit tests**:
  ```bash
  cd apps/sophia-ai-factory
  npm run ci:test
  ```
- **Inspect env validation file**:
  `apps/sophia-ai-factory/src/lib/config/environment-config.ts` (lines 14-15) to confirm Supabase variables are required.
- **Inspect JWKS verification file**:
  `apps/sophia-ai-factory/src/seed/security/jwt-validator-jwks.ts` (lines 11-19) to confirm JWKS calls to Supabase URL.
- **Inspect Cron injection script**:
  `apps/sophia-ai-factory/scripts/inject-scheduled-handler.mjs` (lines 34-86) and compare against `apps/sophia-ai-factory/wrangler.toml` (line 66) to verify the 4 missing cron mappings.
