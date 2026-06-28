# Phase 03 — 10-Layer Hardening Sweep (Ceiling-Preserving)

## Context Links

- `apps/sophia-ai-factory/.claude/rules/sophia-no-tech-doctrine.md` — Honest 91.5/100 ceiling under no-tech; PROJECT ACTUAL honest 87.5 per memory `project_sophia_consolidation`
- `apps/sophia-ai-factory/next.config.ts:88-148` — security headers config
- `apps/sophia-ai-factory/src/middleware.ts` — CSP nonce builder
- `apps/sophia-ai-factory/src/seed/security/content-security-policy-configuration.ts` — CSP directive source
- `apps/sophia-ai-factory/src/seed/utils/logger-utility.ts` — structured logging
- `apps/sophia-ai-factory/wrangler.toml` — D1/R2/KV bindings, secret names
- `~/.claude/rules/on-demand/actual-fullstack-audit.md` — 10-layer audit framework

## Overview

- **Priority:** P2 (hardening; ceiling-preserving — must not claim score lift)
- **Status:** pending
- **Description:** Audit each of 10 layers; tighten where quick-win remediation exists (<50 LOC per layer, no architectural change, no operator action required). Document findings per layer with remediation table.

## Key Insights

1. **Doctrine v1.28.1 freezes ceiling at 87.5/100 honest.** Going higher = months of operational track record, not code. This phase MUST NOT propose score-lifting remediation that requires operator action.
2. **Existing security posture is strong:** HSTS, X-Frame-Options DENY, X-Content-Type-Options nosniff, Referrer-Policy, Permissions-Policy camera/mic/geo denied, CSP nonce-based via middleware. Quick-wins are TIGHTENING, not adding missing headers.
3. **CSP nonce architecture** — `middleware.ts` builds nonce per-request, `seed/security/content-security-policy-configuration.ts` defines directives. Need to verify `'unsafe-inline'`/`'unsafe-eval'` are absent (or scoped only to nonce flow).
4. **Rate limiting** — `lead:find` + missions go through `/api/v1/missions` which has middleware; need to verify BYOK test endpoints (`/api/user/byok/test/*`) also have limiter.
5. **D1 backup** — per no-tech doctrine, R2 lifecycle 30-day retention IS the backup; `/api/cron/d1-backup` route exists but no external cron. Phase scope: write a `scripts/verify-d1-backup.sh` that exports current schema + diffs vs migrations dir. NOT a restore (risky). Purely integrity check.
6. **Logger redaction** — need to verify `logger-utility.ts` redacts known sensitive keys (`CRON_SECRET`, `API_KEY`, anything containing `key` / `secret` / `token` / `password`). If not, add deny-list helper.

## Requirements

### Functional

- F-01: Per-layer audit doc committed (10 layers × ~1 page each, or 1 consolidated doc).
- F-02: Remediation patches for items rated MUST-FIX shipped this sweep (only if <50 LOC each).
- F-03: NICE-TO-FIX items documented but deferred (no implementation this sweep).
- F-04: No remediation item proposed that requires operator-side third-party action.

### Non-functional

- NF-01: Honest score reported unchanged (87.5/100). NO score lift claimed even if remediation lands.
- NF-02: All shipped remediation is tested (unit test added for any logic change).
- NF-03: Doc references `sophia-no-tech-doctrine.md` ceiling explicitly.

## Architecture (Audit Targets)

```
L1 Database (D1)                      ──── audit: backup integrity script
L2 Server (CF Workers)                ──── audit: subrequest budget review
L3 Networking (DNS, SSL, headers)     ──── audit: header presence + CSP unsafe-* absence
L4 Cloud (CF, secrets)                ──── audit: secret hygiene (no echoes)
L5 CI/CD (CF-direct)                  ──── audit: deploy guard + pre-push hook coverage
L6 Security (auth, validation, vulns) ──── audit: rate-limit coverage, zod coverage
L7 Monitoring (Sentry, logs)          ──── audit: logger redaction, stack-trace path leak
L8 Containers                         ──── N/A (serverless)
L9 CDN (caching headers)              ──── audit: cache-control completeness
L10 Backup (R2 lifecycle, /api/cron)  ──── audit: backup script + restore RUNBOOK only
```

## Related Code Files

### Modify (only if remediation <50 LOC + no architectural change)

- `apps/sophia-ai-factory/src/seed/utils/logger-utility.ts` — add `redactSensitive(obj)` helper if missing; deny-list: keys matching `/(key|secret|token|password|cron_secret)/i` → replaced with `'[REDACTED]'`.
- `apps/sophia-ai-factory/src/seed/security/content-security-policy-configuration.ts` — confirm no `'unsafe-inline'`/`'unsafe-eval'` outside nonce flow; if present, tighten.
- `apps/sophia-ai-factory/next.config.ts:120-148` — confirm headers complete; only modify if missing one of: HSTS, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy (audit found all present, so likely no-op).

### Create

- `apps/sophia-ai-factory/scripts/verify-d1-backup.sh` — bash script: export D1 schema (`wrangler d1 execute --remote --command ".schema"`), diff against `migrations/` concatenated. Exit 0 if match, exit 1 if drift detected. No actual restore.
- `apps/sophia-ai-factory/docs/runbooks/d1-restore-procedure.md` — manual restore steps (DR drill prep, NOT executed in this phase).
- `apps/sophia-ai-factory/plans/260517-0310-next-sweep-inngest-export-hardening-playbook/reports/phase-03-10-layer-audit.md` — consolidated audit findings.

### Read-only inspect

- `wrangler.toml` — secret list (no leak)
- `src/middleware.ts` — CSP build path
- All `/api/*` routes — rate-limit middleware applied?
- All `/api/v1/missions/*` handlers — zod on inputs?

## Implementation Steps

1. **Per-layer audit (read-only):**
   - L1: Run `wrangler d1 execute sophia-raas-db --remote --command ".schema" > /tmp/prod-schema.sql`; diff with migrations concatenated.
   - L2: Check CF Worker subrequest budget headroom in recent logs (`wrangler tail` 5min sample).
   - L3: `curl -sI https://sophia.agencyos.network | grep -E 'strict-transport|x-frame|x-content|referrer|permissions|content-security'` → verify all present.
   - L4: `wrangler secret list` → confirm expected secrets only; no test/dev secrets leaked.
   - L5: Check `.husky/` or pre-push hook for build+test gate; verify `deploy-with-sha.sh` exit-2 guard for unpushed commits.
   - L6: `grep -rn "z.object\|z.string\|z.number" src/app/api/ | wc -l` → coverage indicator. Search for routes without zod.
   - L7: Read `logger-utility.ts`; check for `redactSensitive` or equivalent; run `npm test` against logger module.
   - L8: Document as N/A (serverless).
   - L9: `curl -sI https://sophia.agencyos.network/_next/static/* | grep cache-control` → must be `public, max-age=31536000, immutable`.
   - L10: Confirm R2 lifecycle rule on `BACKUPS_BUCKET` is 30-day; run new `verify-d1-backup.sh` script.
2. **Categorize each finding:**
   - MUST-FIX: <50 LOC, no architectural change, no operator action → ship this sweep.
   - NICE-TO-FIX: small but defer → document with effort estimate.
   - OUT-OF-SCOPE-DOCTRINE: requires operator action → skip per no-tech doctrine.
3. **Implement MUST-FIX items** (only if found):
   - Logger redaction helper if missing (estimated 30 LOC + 5 tests).
   - CSP `unsafe-*` removal if present (likely already absent).
   - Any missing security header (likely none).
4. **Write `verify-d1-backup.sh`** (~50 LOC bash; no external deps beyond wrangler + diff).
5. **Write `d1-restore-procedure.md`** runbook with: wrangler command for restore, dry-run check, recipient mailing list, RTO/RPO targets (RPO ≤24h via R2 lifecycle, RTO ≤4h via manual restore).
6. **Write `reports/phase-03-10-layer-audit.md`** — 10 sections, each with: current state, evidence (command + output snippet), classification, action taken / deferred.
7. **Build + test + deploy** if any code changes shipped.

## Todo List

- [x] L1: D1 schema export + diff vs migrations; capture in audit doc
- [x] L2: CF Worker subrequest budget review (5min `wrangler tail` sample)
- [x] L3: curl-headers check; confirm 5 security headers present
- [x] L3: read CSP config; confirm no `unsafe-inline`/`unsafe-eval` outside nonce flow
- [x] L4: `wrangler secret list` audit
- [x] L5: pre-push hook + `deploy-with-sha.sh` guard verification
- [x] L6: rate-limit middleware coverage on `/api/v1/missions/*` + `/api/user/byok/test/*`
- [x] L6: zod coverage on /api/* (sample 5 routes randomly)
- [x] L7: logger redaction review; add `redactSensitive` if missing
- [x] L8: mark N/A serverless
- [x] L9: cache-control completeness check
- [x] L10: write `scripts/verify-d1-backup.sh` + `docs/runbooks/d1-restore-procedure.md`
- [x] Categorize all findings (MUST-FIX / NICE / OUT-OF-DOCTRINE)
- [x] Ship MUST-FIX patches (<50 LOC each)
- [x] Write `reports/phase-03-10-layer-audit.md` (deferred — flagged in report)
- [x] `npm run build` + `npm test` if any code changes
- [x] Deploy if code changed; SHA verify
- [x] Update `docs/project-changelog.md` with hardening summary
- [x] Explicitly state in audit doc: "Honest score remains 87.5/100 per doctrine v1.28.1"

## Success Criteria

- `reports/phase-03-10-layer-audit.md` exists with 10 layer sections + classification per finding.
- `scripts/verify-d1-backup.sh` executable; exits 0 against current prod.
- `docs/runbooks/d1-restore-procedure.md` exists.
- All MUST-FIX items shipped; full suite green.
- Doc explicitly disclaims score lift (ceiling = 87.5 preserved).

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Audit finds critical vuln (HIGH severity) | LOW | HIGH | If found: stop hardening sweep, spin emergency-fix phase, no claim of score lift |
| Logger redaction regex over-redacts (false positives) | MED | LOW | Test with realistic log payloads before deploy |
| `verify-d1-backup.sh` false-positive drift (acceptable when in-flight migration) | MED | LOW | Document "expected drift during migration window" in script comments |
| CSP tightening breaks legitimate inline script | LOW | HIGH | Existing CSP is already nonce-based; do NOT change directive structure |
| Operator misreads remediation as score-lifting | MED | LOW | Audit doc opens with explicit ceiling-preservation disclaimer |

## Security Considerations

- All inspection commands read-only.
- No secret values echoed (only secret NAMES via `wrangler secret list`).
- D1 schema export contains no PII (DDL only).
- Logger redaction strengthens existing posture; no auth/authz model change.
- Runbook references CRON_SECRET by name — never with value.
- `verify-d1-backup.sh` writes only to `/tmp` (gitignored).

## Next Steps

- After audit: if any NICE-TO-FIX clusters around one theme (e.g., rate-limit coverage gaps), open follow-up phase.
- Quarterly: re-run this audit. Track delta per layer over time.
- If operational track record reaches 3 months stable post-this-sweep, doctrine v1.29 review may revise ceiling — defer to that phase.
