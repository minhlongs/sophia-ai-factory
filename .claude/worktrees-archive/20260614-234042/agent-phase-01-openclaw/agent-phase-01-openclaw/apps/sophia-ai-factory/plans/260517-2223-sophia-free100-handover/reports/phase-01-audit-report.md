# Phase 01 Audit Report — 2026-05-17

**Phase:** 01 — Audit & Worktree Cleanup
**Plan:** `plans/260517-2223-sophia-free100-handover/`
**Executed:** 2026-05-17 22:55–23:05 PT
**Status:** ✅ COMPLETE (Step 8 partial — see §Findings)

---

## Baseline Verified

| Metric | Expected (plan) | Actual | Status |
|---|---|---|---|
| Canon HEAD | `05b62157` | `05b62157` clean (only new plan dir + 4 salvaged files untracked) | ✅ |
| Test files | ~1,444 | **4,478 tests across 446 files** (445 pass + 1 skipped file; 4,446 pass + 32 skipped tests) | ✅ ahead of memory |
| Lint errors | 0 | 0 | ✅ |
| Lint warnings | ~423 | **340** | ✅ -83 vs memory baseline |
| FREE100 PROD seed | ≥1 active row | 1 row: `code=FREE100`, `discount_type=free_full`, `applies_to_tier=MASTER`, `max_uses=50`, `max_uses_per_user=1`, `status=active`, valid 2026-04-30 → 2026-07-30 | ✅ |
| NOWPayments secrets | `NOWPAYMENTS_API_KEY` + `NOWPAYMENTS_IPN_SECRET` | Both present + `NOWPAYMENTS_WALLET` bonus | ✅ |
| Worktree archived | `~/sophia-ai-factory` → `.archived-260517` | Done + STOP marker | ✅ |
| Production deploy SHA match | local HEAD ↔ `/api/version` | local `05b62157` ↔ live `05b62157` | ✅ |

---

## Worktree Archive — Salvage Decisions

**Stale path state:** HEAD `b0b34ffd` (behind canon by 20+ commits), 19 modified files (uncommitted), 4 untracked files.

**Salvaged → canon worktree** (user decision):
1. `apps/sophia-ai-factory/scripts/deploy-full-verified.sh` (32 lines) — deploy + browser gate
2. `apps/sophia-ai-factory/scripts/verify-production-deploy.sh` (42 lines) — verify Worker serves current commit
3. `apps/sophia-ai-factory/scripts/e2e-go-live-user-gap.sh` (33 lines) — strict prod E2E gate
4. `apps/sophia-ai-factory/tests/e2e/go-live-user-gap.spec.ts` (75 lines) — Better Auth sign-in + dashboard + video form E2E spec

All 4 made executable. Useful for Phase 08 (Playwright E2E) + Phase 10 (final smoke).

**Discarded** (user decision): 19 modified files (canon HEAD ahead with newer versions; outdated edits in stale).

**Archived:** `~/sophia-ai-factory.archived-260517/` (3.9GB) with marker `.archived/STOP-DO-NOT-USE` documenting the move.

---

## Dashboard Smoke (Unauthenticated curl)

All 20 protected routes return **307** (redirect-to-login) — correct behavior for protected routes:

```
/vi/dashboard            307 ✅    /vi/dashboard/onboarding   307 ✅
/vi/dashboard/wallet     307 ✅    /vi/dashboard/help         307 ✅
/vi/dashboard/templates  307 ✅    /vi/dashboard/proposals    307 ✅
/vi/dashboard/affiliate  307 ✅    /vi/dashboard/analytics    307 ✅
/vi/dashboard/campaigns  307 ✅    /vi/dashboard/settings     307 ✅
/vi/dashboard/orders     307 ✅    /vi/dashboard/sop-market.. 307 ✅
/vi/dashboard/account    307 ✅    /vi/dashboard/missions     307 ✅
/vi/dashboard/sops       307 ✅    /vi/dashboard/experiments  307 ✅
/vi/dashboard/api-docs   307 ✅    /vi/redeem                 200 ✅ (public)
/vi/dashboard/create     307 ✅
/vi/dashboard/credits    307 ✅
/vi/dashboard/billing    307 ✅
```

**Health endpoints:**
- `https://sophia.agencyos.network` → HTTP/2 200
- `/api/version` → `{"shortSha":"05b62157","deployedAt":"2026-05-18T05:11:16Z","opennextVersion":"1.17.3"}`

**Deferred:** Full authenticated browser walk (console errors, missing i18n keys IN rendered pages, broken layouts). Moved to Phase 08 (Playwright E2E using salvaged `go-live-user-gap.spec.ts`).

---

## Findings (logged to `docs/known-issues.md`)

| Severity | Issue |
|---|---|
| P2 | `OPENNEXT_VERSION` hardcoded `"1.17.3"` vs `package.json ^1.19.5` (`src/app/api/version/route.ts:33`) — confirmed via `/api/version` |
| P2 | Stale `POLAR_*` secrets (7 entries) still wired in CF Worker — doctrine forbids; delete after verifying no code refs |
| P2 | 2 `vi.mock` nested calls (future Vitest error) — `receipt-email.test.ts`, `storage-tracker.test.ts` |
| P2 | 4 k6 anonymous default exports — `tests/load/k6-{soak,spike,steady,stress}.js` |
| P3 | Auth-browser dashboard walk deferred to Phase 08 |

**No P0/P1 found.**

---

## Blockers for Phase 02

**None.** All gates green:
- ✅ Canon worktree clean, divergence risk eliminated
- ✅ Test suite green (4,446 pass)
- ✅ Lint clean (0 errors)
- ✅ FREE100 base seed exists in PROD D1 (50 slots; for Phase 03 expansion we add `FREE100-XXXX` separate codes — base unaffected)
- ✅ NOWPayments creds live
- ✅ Production deploy SHA matches local HEAD

**Caveats for Phase 02 (staging setup):**
- Memory still claims tests=410, lint=423w — both stale. Updated values 4,446/340 propagated to this report; memory update deferred to final Phase 10.
- Staging worker `sophia-staging.agencyos.network` confirmed missing (Phase 02 must create).

---

## Commands Executed (for reproducibility)

```bash
# Pre-flight + archive
lsof +D ~/sophia-ai-factory                                      # empty
git -C ~/sophia-ai-factory status --short                        # 19M + 4??
diff ~/sophia-ai-factory/<f> ~/projects/sophia-ai-factory/<f>    # all differ
cp ~/sophia-ai-factory/apps/.../scripts/{deploy-full-verified,verify-production-deploy,e2e-go-live-user-gap}.sh \
   ~/projects/sophia-ai-factory/apps/.../scripts/
cp ~/sophia-ai-factory/apps/.../tests/e2e/go-live-user-gap.spec.ts \
   ~/projects/sophia-ai-factory/apps/.../tests/e2e/
chmod +x ~/projects/sophia-ai-factory/apps/.../scripts/{deploy-full-verified,verify-production-deploy,e2e-go-live-user-gap}.sh
mv ~/sophia-ai-factory ~/sophia-ai-factory.archived-260517
# (marker file written)

# Baseline
git rev-parse HEAD | cut -c1-8                                   # 05b62157
npm test 2>&1 | tee /tmp/phase-01-tests.log                      # 4446/4478 pass
npm run lint 2>&1 | tee /tmp/phase-01-lint.log                   # 0 errors, 340 warn

# PROD verify (read-only)
npx wrangler d1 execute sophia-raas-db --remote \
  --command "SELECT … FROM promo_codes WHERE code LIKE 'FREE100%'"   # 1 active row
npx wrangler secret list --name sophia-ai-factory                    # 3 NOWPAYMENTS_*
curl -s https://sophia.agencyos.network/api/version | jq .shortSha   # 05b62157 == HEAD
```

---

## Next

→ **Phase 02 — Staging Worker + D1 Setup.** No blockers. Begin: create `wrangler.staging.toml`, provision `sophia-raas-db-staging` D1, run 113 migrations, deploy staging worker, wire health endpoint.
