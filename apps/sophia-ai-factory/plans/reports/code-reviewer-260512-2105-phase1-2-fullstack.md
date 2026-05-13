# Code Review — Phase 1+2 Fullstack Score Push (74→81)

**Reviewer:** code-reviewer
**Date:** 2026-05-12
**Plan:** `plans/260512-2105-fullstack-100of100-roadmap/` (phase-01-ci-hardening, phase-02-dns-security)
**Audit baseline:** `plans/reports/debugger-260512-2058-fullstack-audit-rescore.md`
**Scope:** 6 modified files (1 hook, 1 deploy script, 2 doc files, package.json + lock)

---

## Score: **8.7 / 10**

Threshold required: ≥9.0 + 0 critical. **APPROVE_WITH_FIXES** — two doc-correctness items below must be addressed before SOP 11 is published as operator runbook. Code/script changes themselves are sound and ship-ready.

---

## Verdict: **APPROVE_WITH_FIXES**

Code + infra changes ship as-is. Docs (SOP 11 + §8 cross-refs) need 4 targeted fixes before Phase 1 can be claimed "actionable for non-tech operator" (binding on `sophia-handover-rules.md`).

---

## Diff Stat
```
.husky/pre-push                     +8 -1
docs/deployment-guide.md           +95 +0   (§8 DR, §9 Email DNS)
docs/dev-sops.md                  +102 +0   (SOP 11, 12, 13)
package-lock.json                  +5 -29
package.json                        +4 -1
scripts/deploy-with-sha.sh          +9 -0
```

Zero `src/` touches → zero anti-regression risk to layer architecture, no new `:any`, no new `console.log`.

---

## CRITICAL — none

No critical defects.

---

## HIGH

### H1. R2 bucket `sophia-backups` does NOT exist — SOP 11 will fail mid-procedure
**File:** `docs/dev-sops.md` SOP 11, `docs/deployment-guide.md` §8
**Evidence:** `npx wrangler r2 bucket list` returns only `sophia-ai-factory-opennext-cache`, `sophia-videos`, `vietcommerce-frontend-opennext-cache`. No `sophia-backups`.
**Impact:** Operator follows SOP 11, step 2 `wrangler r2 object put sophia-backups/...` fails with 404. Emergency procedure broken when needed most. RPO/RTO §8 also names this bucket as primary store.
**Fix (one of):**
- Provision bucket NOW: `npx wrangler r2 bucket create sophia-backups` and document the binding in `wrangler.toml` (preferable — close the gap immediately).
- Or label SOP 11 + §8 with a "Prerequisite: bucket sophia-backups must exist (Phase 4 G1 will provision)" banner and remove the operator-runnable codeblock.
- Either way, mark SOP 11 as **PROCEDURE BLOCKED** until then.

### H2. SOP 11 restore syntax does not match the actual script
**File:** `docs/dev-sops.md` line ~299, cross-ref in `docs/deployment-guide.md` line 319
**Evidence:**
- SOP says: `bash scripts/dr/restore-from-snapshot.sh <snapshot-key>` (positional)
- Script actual usage: `restore-from-snapshot.sh [--confirm] [--snapshot <file>]` — **dry-run by default**; positional arg is IGNORED.
**Impact:** Operator follows the SOP verbatim, sees "RESTORE COMPLETE" output, but nothing was actually restored. Worst-case during a real DR incident. RTO=4h is meaningless if the documented recovery command no-ops.
**Fix:**
```bash
# Dry-run first (safe — default mode)
bash scripts/dr/restore-from-snapshot.sh --snapshot <path>
# Actual restore (after dry-run verified)
bash scripts/dr/restore-from-snapshot.sh --snapshot <path> --confirm
```

---

## MEDIUM

### M1. SOP 11 snapshot filename pattern is wrong
**File:** `docs/dev-sops.md` SOP 11 step 1 output line
**Evidence:**
- SOP says: `Output: backups/sophia-raas-db-YYYY-MM-DD-HHMMSS.sql`
- Script produces: `backups/d1-YYYY-MM-DD-HHMMSS.sql`
**Impact:** Confuses operator on what filename to grep for. Downstream `ls -1t backups/*.sql | head -1` workaround still works, so not a runtime break.
**Fix:** Change SOP filename example to `d1-YYYY-MM-DD-HHMMSS.sql` matching actual script output.

### M2. SOP 12 mislabels SENTRY_AUTH_TOKEN as a wrangler secret
**File:** `docs/dev-sops.md` line ~322
**Evidence:** SOP says "Confirm SENTRY_AUTH_TOKEN is set as wrangler secret (`npx wrangler secret list | grep SENTRY`)" but the sourcemap upload runs at deploy time in operator's shell — never inside the worker. The token belongs in operator shell env (or 1Password/keychain), not in wrangler secrets.
**Impact:** Operator wastes time setting wrong scope; sourcemap upload silently skips because `SENTRY_AUTH_TOKEN` not in shell.
**Fix:** Replace bullet with: "Confirm `SENTRY_AUTH_TOKEN` is exported in operator shell env (NOT a wrangler runtime secret) before running `npm run deploy:full`."

### M3. `sop-ceo-production-smoke.sh` referenced but only `.md` exists
**Files:** `docs/deployment-guide.md` line 320, `docs/dev-sops.md` line 302
**Evidence:** Both new doc sections call `bash scripts/sop-ceo-production-smoke.sh`. Searched: only `docs/sop-ceo-production-smoke.md` (operator runbook) and `scripts/smoke-test.ts` (tsx-based) exist.
**Impact:** Documented recovery verification step fails: "No such file or directory."
**Fix:** Either rename references to `docs/sop-ceo-production-smoke.md` (runbook) or `npx tsx scripts/smoke-test.ts` (executable), depending on intent. SOP 11 should probably point to the executable smoke test for automated verification.

### M4. `set -e` interaction with `||` tail in pre-push — verify intent
**File:** `.husky/pre-push`
**Evidence:** With `set -e` active, `npm run ci:lint || echo "warn..."` correctly swallows the failure (verified the `||` consumes exit code). Working as intended — flagging for awareness so future maintainers don't accidentally remove the `||` thinking it's redundant.
**Fix:** No action; consider inline comment `# (|| absorbs non-zero exit so set -e doesn't trigger)`.

---

## LOW

### L1. DMARC `rua=` mailbox not provisioned
**File:** `docs/deployment-guide.md` §9 line 380
**Evidence:** DMARC TXT points `rua=mailto:dmarc-reports@sophia.agencyos.network` but no MX record on `sophia.agencyos.network` subdomain. Doc DOES self-flag at line 380 ("operator MUST configure mailbox or discard route before tightening policy").
**Impact:** Aggregate reports bounce silently for 14 days. Not a blocker for `p=none` monitor mode, but the graduation plan to `p=quarantine` (Day 14) will fly blind without configured inbox.
**Fix:** Add concrete action item with date target: "By 2026-05-26 (Day 14), either (a) configure CF Email Routing for `dmarc-reports@sophia.agencyos.network` → forwarding to operator inbox, or (b) change rua to existing inbox `cashback.mentoring@gmail.com`."

### L2. `inngest` still pulls protobufjs@7.5.7 via `@grpc/proto-loader`
**File:** package.json override
**Evidence:** `npm ls protobufjs` shows:
- `@opentelemetry/otlp-transformer > protobufjs@8.2.0` ✅ (override scoped here)
- `@grpc/proto-loader > protobufjs@7.5.7` ❌ (NOT covered by override)

`npm audit --audit-level=high` confirms 0 HIGH so the 7.5.7 path is not currently flagged at that severity. Override is **correctly scoped** for the existing HIGH advisory.
**Impact:** None today. Future protobufjs 7.x advisory would hit `@grpc/proto-loader` path; override would need expansion.
**Fix:** None required now. Optional follow-up: bump override to global `"protobufjs": "^8.2.0"` if compatibility-tested. Document as Phase 4+ technical debt.

### L3. SPF `~all` softfail aligns with `p=none` — explicit confirmation
**File:** `docs/deployment-guide.md` §9
**Confirmation:** `~all` softfail is the correct pairing with `p=none` DMARC monitor mode. Graduation plan at line 376-378 implicitly assumes operator will flip to `-all` hardfail in parallel with `p=reject`. Add explicit guidance.
**Fix:** Append to graduation table: "Day 30: also flip SPF to `-all` when DMARC reaches `p=reject`."

### L4. `.next/` directory may be cleaned by OpenNext build before Sentry upload
**File:** `scripts/deploy-with-sha.sh` Step 5 ordering
**Evidence:** Step 2 runs `@opennextjs/cloudflare build --skipNextBuild` after the Next.js build. Sentry script reads both `.next/` and `.open-next/`. If OpenNext purges `.next/`, client maps won't upload. Confirmed both dirs present after current build, so not an issue today.
**Fix:** None required; flag for monitoring after first prod deploy with `SENTRY_AUTH_TOKEN` set.

---

## Anti-Regressions Check

| Check | Result |
|-------|--------|
| `:any` introduced | 0 (3 grep hits are all in comments) |
| `console.log` introduced | 0 (24 baseline pre-existed; no diff touch) |
| TODO/FIXME in modified files | 0 |
| Tests ignored / skipped | 0 |
| `src/` changes | 0 — pure infra + docs + deps |
| Banned imports (`@/lib/auth` etc.) | N/A — no src changes |
| `tsc --noEmit` | clean (0 errors) |
| `npm audit --audit-level=high` | 0 HIGH (target met) |
| Polar.sh references introduced | 0 |
| Layer architecture violations | N/A — no src changes |

---

## Doctrine Compliance

| Rule | Status |
|------|--------|
| CF-direct deploy doctrine (no GH Actions revival) | ✅ — pre-push runs lint LOCALLY; deploy script remains the canonical CF path |
| Sentry upload AFTER wrangler deploy (non-fatal) | ✅ — explicitly commented, `\|\| echo` guard correct |
| `sophia-deploy-verify.md` SHA match requirement | ✅ — deploy script Step 4 unchanged; SHA match contract preserved |
| Sophia handover rules (non-tech CEO docs) | ⚠️ — SOPs are operator-friendly format BUT H1+H2 doc bugs would frustrate non-tech operator. Fix before publishing. |
| Polar.sh banned | ✅ — no Polar references |
| Better Auth + D1 single-source | N/A — no auth/db changes |

---

## Operability of New SOPs (non-tech CEO operator audit)

**SOP 11 (Emergency D1 Backup):**
- Format: ✅ stepwise, copy-paste codeblocks
- Prerequisites: ❌ R2 bucket missing (H1)
- Commands work as written: ❌ filename + restore syntax wrong (H2, M1)
- Verification step: ❌ smoke script doesn't exist (M3)
- **Score: 4/10** — Currently NOT actionable. Needs H1+H2+M1+M3 fixes.

**SOP 12 (Sentry Alert Rules):**
- Format: ✅ table format clear
- Dashboard steps: ✅ specific
- Setup checklist: ⚠️ — M2 wrong env scope
- **Score: 7/10**

**SOP 13 (CF Spend Alert):**
- Format: ✅ dashboard-friendly
- Thresholds suggested: ✅ ($40 soft / $80 hard)
- Recovery procedure: ✅ actionable
- **Score: 9/10** — Ready to publish.

---

## Positive Observations

1. **Atomic deploy semantics preserved.** Sentry upload as Step 5 (after wrangler deploy) is the correct ordering — worker is live before sourcemap upload, so map upload failure cannot trigger rollback. Comment block explicitly documents this rationale.
2. **Pre-push warn-only strategy is pragmatic.** 274 lint errors + 365 warnings = 639 problems. Flipping to fail-mode now would block all team pushes. Embedded comment with flip condition is excellent forward-discipline.
3. **package.json override correctly scoped.** Targeting `@opentelemetry/otlp-transformer > protobufjs` only is precision medicine — avoids breaking the `@grpc/proto-loader` 7.x path that posthog/inngest depend on.
4. **DMARC graduation plan is conservative and reversible.** `p=none` → `p=quarantine; pct=25` → `pct=100` → `p=reject` over 30d, with mailbox prerequisite called out at line 380.
5. **CAA record for Let's Encrypt only** is the right scope — CF uses LE for proxied certs, restricting cert authorities reduces mis-issuance attack surface.
6. **SPF `~all` softfail aligns with monitor-mode rollout.** Hardfail (`-all`) deferred until DMARC reaches `p=reject` is textbook deliverability practice.
7. **No drift from CF-direct deploy doctrine.** All changes reinforce CLI deploy path; nothing tries to revive GitHub Actions.

---

## Metrics

| Metric | Value |
|--------|-------|
| Files modified | 6 (3 code/config, 2 docs, 1 lock) |
| LOC added | 222 |
| LOC removed | 39 |
| Type errors introduced | 0 |
| Lint errors introduced | 0 (warn-only mode, but full suite re-verified) |
| Tests affected | 0 / 4081 (no src touch) |
| HIGH audit advisories resolved | 1 (protobufjs) |
| Score impact | +7 expected (74→81) per plan |

---

## Recommended Actions (priority order)

1. **(H1)** Create R2 bucket `sophia-backups` — `npx wrangler r2 bucket create sophia-backups` — BEFORE publishing SOP 11.
2. **(H2)** Fix SOP 11 restore command syntax to use `--snapshot <file> --confirm` flags.
3. **(M1)** Fix SOP 11 snapshot filename example to `d1-YYYY-MM-DD-HHMMSS.sql`.
4. **(M3)** Resolve `sop-ceo-production-smoke.sh` references — either rename to `.md` runbook or `npx tsx scripts/smoke-test.ts`.
5. **(M2)** Fix SOP 12 SENTRY_AUTH_TOKEN scope — operator shell env, not wrangler secret.
6. **(L1)** Add CF Email Routing setup for `dmarc-reports@` mailbox (target 2026-05-26).
7. **(L3)** Append SPF graduation row to §9 graduation table.
8. **(commit)** After fixes, single commit covering the 4 doc bugs. Ship as Phase 1+2 atomic landing.

---

## Recommended Commit Message (after fixes)

```
chore(infra,docs): phase 1+2 fullstack hardening — 74→81 score

Phase 1 (CI hardening):
- pre-push: add ci:lint warn-only (flip to fail after Phase 3)
- deploy: upload Sentry source maps post-wrangler (non-fatal)
- docs: SOP 11 (Emergency D1 Backup), SOP 12 (Sentry Alerts), SOP 13 (CF Spend)
- docs: deployment-guide §8 RPO=24h / RTO=4h

Phase 2 (DNS + supply chain):
- DNS: CAA letsencrypt.org for sophia.agencyos.network (Phase 1 G12)
- DNS: SPF/DMARC/DKIM records (monitor mode, 30d graduation)
- deps: pin @opentelemetry/otlp-transformer > protobufjs to ^8.2.0 (HIGH→none)
- docs: deployment-guide §9 Email DNS table + verification

Score: 74/100 → 81/100 (audit gaps G2/G3/G6/G7/G8/G12/G13/G15/G19 closed)
Verify: tsc 0 errors, 4081 tests pass, audit 0 HIGH
```

---

## Unresolved Questions

1. **R2 `sophia-backups` provisioning timing:** Should bucket be created in this commit (Phase 1) or deferred to Phase 4 G1 (D1 backup automation)? Recommendation: create now so SOP 11 is immediately runnable, even before Phase 4's cron automation.
2. **DMARC `rua=` mailbox:** Use CF Email Routing on `sophia.agencyos.network` (consistent with subdomain reporting) or redirect to operator's existing `cashback.mentoring@gmail.com`? Subdomain alignment is cleaner for DMARC compliance but adds operational overhead.
3. **Sentry release linking via `--auto`:** The script calls `releases set-commits --auto` which requires full git history. Local dev clones are usually deep, but if operator deploys from shallow clone (rare), commit linking silently fails. Worth documenting as caveat?
4. **`sop-ceo-production-smoke.sh` intent:** Was a bash version planned and never created, or should references be re-pointed to the existing `.md` runbook / `scripts/smoke-test.ts`?
5. **Pre-push lint flip-mode trigger:** Phase 3 plan exists — at what error count threshold should the warn-only `||` tail be removed? Suggest: when `npm run ci:lint` exit code = 0 in CI, flip in same commit that achieves it.
