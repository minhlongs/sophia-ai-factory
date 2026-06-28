# Load Testing & E2E Operational Runbook

> Operator guide for running k6 load profiles and Playwright E2E suites against Sophia AI Factory.
> Owner: Platform on-call. Last updated: 2026-05-11.

---

## 1. When to run

| Trigger | Profile | Why |
|---|---|---|
| Pre-launch growth campaign | k6 spike + soak | Confirm autoscale headroom before traffic surge |
| Suspected memory leak | k6 soak (2h) | Watch RSS / connection-pool over long window |
| Pre-major-feature merge | Playwright full suite + k6 steady | Regression net + correctness baseline |
| Post-incident verification | Playwright affected scenarios | Confirm fix doesn't break neighbouring flows |
| Quarterly baseline refresh | All k6 profiles + Playwright full | Drift detection |

---

## 2. Playwright E2E

### Run against production

```bash
cd apps/sophia-ai-factory
PLAYWRIGHT_TEST_BASE_URL=https://sophia.agencyos.network \
  npx playwright test
```

### Run against local dev

```bash
npm run dev                           # in one terminal
PLAYWRIGHT_TEST_BASE_URL=http://localhost:3000 \
  npx playwright test                  # in another
```

### Discover available specs

```bash
npx playwright test --list             # lists all 106+ tests across 16 spec files
```

### Last verified baseline (2026-05-10 21:36 PT)

| Metric | Value |
|---|---|
| Total tests | 106 |
| Pass | 100 |
| Skipped | 6 (positive-auth flows needing signed Better Auth session) |
| Fail | 0 |
| Wall-clock | 58.9s |
| Target | `https://sophia.agencyos.network` |

Skipped tests are explicitly guarded via `test.skip()` and documented inline — they require a signed Better Auth session + local D1. Will unblock once the reusable auth fixture lands.

Archive: `apps/sophia-ai-factory/plans/reports/e2e-260510-2136-green-run.md`

### Specs by scenario

| # | Scenario | Spec file | Coverage level |
|---|---|---|---|
| 1 | Anonymous signup → dashboard | `auth-signup.spec.ts` | full |
| 2 | Free → Starter upgrade | `nowpayments-upgrade.spec.ts` | smoke (anon 401) |
| 3 | Video gen → publish | `video-pipeline.spec.ts` | smoke |
| 4 | Affiliate signup → conversion | `affiliate-flow.spec.ts` | full |
| 5 | Refund 14d | `refund-flow.spec.ts` | smoke |
| 6 | Admin alert triage | `admin-alerts-triage.spec.ts` | smoke |
| 7 | OAuth (TikTok / YouTube) | `oauth-link-flow.spec.ts` | smoke |
| 8 | Locale EN↔VN | `locale-switch.spec.ts` | full |
| 9 | 401 redirect + return-to | `auth-redirect.spec.ts` | full |
| 10 | Dunning failed payment | `dunning-failed-payment.spec.ts` | smoke |
| 11 | Account self-delete + restore | `account-self-delete.spec.ts` | smoke |
| 12 | Quota exceeded → upsell | `quota-upsell.spec.ts` | full |

---

## 3. k6 Load Profiles

### Install (Homebrew, macOS)

```bash
brew install k6                       # v1.7.1+ verified
k6 --version
```

### npm scripts

```bash
npm run test:load:steady              # 10 VU × 30s baseline (safe vs prod)
npm run test:load:spike               # 0 → 50 VU spike
npm run test:load:soak                # long-running (30min+) — schedule carefully
npm run test:load:stress              # ramp to break — REQUIRES EXPLICIT APPROVAL
```

### Profile definitions

| Profile | VU pattern | Duration | Purpose | Safe vs prod? |
|---|---|---|---|---|
| **steady** | 10 VU | 30s | Latency baseline | ✅ |
| **spike** | 0 → 50 VU in 30s | ~2min | Autoscale validation | ✅ |
| **soak** | 100 VU | 30min+ | Memory leak detection | ⚠️ Use preview env |
| **stress** | Ramp to break | until failure | Find breakpoint | ❌ Requires explicit approval; will burn CF burst quota |

Scripts: `tests/load/k6-{steady,spike,soak,stress}.js`. Shared scenario module: `tests/load/scenarios/public-routes.js`.

### Last verified baseline (2026-05-10 21:50 PT)

**Steady (10 VU × 30s) — production `sophia.agencyos.network`**
| Metric | Value | Threshold | Pass? |
|---|---|---|---|
| Requests | 217 (5.58/s) | — | — |
| Error rate | 0.00% | < 1% | ✅ |
| Checks passed | 310/310 (100%) | — | ✅ |
| `http_req_duration` p95 | 3.46s | < 500ms | ❌ |
| `health_latency_ms` p95 | 2.83s | < 100ms | ❌ |

**Spike (peak 50 VU) — production `sophia.agencyos.network`**
| Metric | Value | Threshold | Pass? |
|---|---|---|---|
| Requests | 1413 (10.88/s) | — | — |
| Error rate | 0.00% | < 2% | ✅ |
| Checks passed | 2018/2018 (100%) | — | ✅ |
| `http_req_duration` p95 | 6.78s | < 500ms | ❌ |
| `health_latency_ms` p95 | 5.19s | < 100ms | ❌ |

**Conclusion:** zero errors, latency targets aspirational. Soak + stress skipped to preserve production headroom.

Archive: `apps/sophia-ai-factory/plans/reports/k6-load-260510-2150.md` + machine-readable JSON at `plans/reports/k6-runs/`.

### Latency interpretation

`p95 ~3.5s` from PT origin reflects:
1. **Geo:** PT → nearest CF POP → upstream R2/D1 region — ~100-300ms baseline overhead
2. **OpenNext SSR:** home page is server-rendered, first-paint ~1-2s
3. **No edge cache** on most routes (only `/api/version` returns Cache-Control)
4. **Cold-start hit** for low-traffic endpoints

To re-baseline from a CF-region client, run k6 from a Workers-region datacenter (closer to CF POP).

### Performance follow-ups (open)

1. Add `Cache-Control: s-maxage=60` to public marketing pages (home, pricing, `/status`)
2. Pre-warm cold paths via cron — scale existing `/api/health` cron to every 5min
3. Consider CF Cache API + ISR for homepage SSR output
4. Move `/api/health` off OpenNext SSR path → pure Worker route for sub-100ms response
5. Re-define realistic SLO: 500ms target seems aspirational; consider 1000–1500ms initial baseline

---

## 4. Auth fixture (signed Better Auth sessions)

Reusable Playwright fixture that performs real Better Auth sign-in via the
`/api/auth/sign-in/email` endpoint, captures the Set-Cookie payload, and
exposes it as the `authenticatedPage` test fixture. Lands 2026-05-11.

### Files

- `tests/e2e/_fixtures/auth-helpers.ts` — pure HTTP helpers (`signIn`, `signOut`)
- `tests/e2e/_fixtures/auth-fixture.ts` — extends Playwright `test` with `authenticatedPage`
- `tests/e2e/authenticated-smoke.spec.ts` — 2 smoke tests proving the fixture works
- `scripts/e2e-bootstrap-user.ts` — one-shot user provisioner

### One-time bootstrap (per environment)

```bash
# Local dev
E2E_TEST_USER_PASSWORD='<strong-password>' \
  npm run e2e:bootstrap-user

# Production / preview
PLAYWRIGHT_TEST_BASE_URL=https://sophia.agencyos.network \
E2E_TEST_USER_PASSWORD='<strong-password>' \
  npm run e2e:bootstrap-user
```

Script is idempotent — if the user already exists, it verifies sign-in still works. Default email `e2e-master@sophia.test` (override via `E2E_TEST_USER_EMAIL`).

### Running auth-gated tests

```bash
# After bootstrap, export password (store in 1Password, not in repo)
export E2E_TEST_USER_PASSWORD='<the password used above>'

# Run only the auth smoke spec
npm run test:e2e -- authenticated-smoke

# Or full suite — auth-gated tests now execute instead of skipping
PLAYWRIGHT_TEST_BASE_URL=https://sophia.agencyos.network \
  npm run test:e2e
```

### Authoring new auth-gated specs

```ts
import { test, expect } from './_fixtures/auth-fixture'

test('only-logged-in users see dashboard', async ({ authenticatedPage }) => {
  await authenticatedPage.goto('/dashboard')
  await expect(authenticatedPage.locator('h1')).toContainText(/dashboard/i)
})
```

**Auto-skip behavior:** if `E2E_TEST_USER_PASSWORD` is not set, all tests using
the fixture skip cleanly with a clear reason — so the default unauthenticated
run remains green.

### Pre-deploy gate (still deferred)

Wiring the auth fixture into `npm run deploy:full` is straightforward once the
production user is bootstrapped + the password is available in CI/local
secrets. Proposed wiring:

```jsonc
// package.json
"deploy:full": "npm test && playwright test --grep @smoke && tsx scripts/deploy-with-sha.sh"
```

Held back from this slice to avoid adding ~60s + cookie persistence to every
deploy without first migrating the existing 6 free100 skipped tests onto the
fixture. The CF-direct doctrine `/api/version` SHA-match check remains the
interim verify gate.

Tracked in `~/plans/260510-0603-sophia-gap-plan/phase-02-e2e-load.md`.

---

## 5. Re-running this baseline

```bash
cd apps/sophia-ai-factory

# 1. Full Playwright run + archive timestamp
PLAYWRIGHT_TEST_BASE_URL=https://sophia.agencyos.network \
  npx playwright test 2>&1 | tee plans/reports/e2e-$(date +%y%m%d-%H%M)-run.md

# 2. k6 steady + spike
npm run test:load:steady
npm run test:load:spike

# 3. Compare against previous baseline in this runbook §3
```

---

## 6. Escalation

| Result | Severity | Action |
|---|---|---|
| E2E pass rate drops below 95% | P1 | Investigate failing scenarios before next deploy |
| k6 error rate > 1% under steady | P0 | Production correctness regression — page on-call |
| k6 p95 doubles vs baseline | P1 | Performance regression — review recent deploys |
| Soak shows > 5% RSS growth over 2h | P1 | Memory leak — capture heap snapshot if Workers tooling allows |
| Stress identifies breakpoint < 100 RPS | P1 | Capacity ceiling reached — scale verification + caching audit |

---

## Seealso

- E2E archive: `apps/sophia-ai-factory/plans/reports/e2e-260510-2136-green-run.md`
- k6 archive: `apps/sophia-ai-factory/plans/reports/k6-load-260510-2150.md`
- k6 machine-readable runs: `plans/reports/k6-runs/`
- Disaster recovery: `docs/disaster-recovery.md`
- Deploy doctrine: `.claude/rules/sophia-deploy-verify.md`

---

## Unresolved

- No automated p95-regression alert — drift detected only on manual baseline refresh.
- Stress profile never run on production; breakpoint unknown. CF burst quota cost makes ad-hoc execution risky.
- Soak profile never run; memory-leak posture unverified for 2h+ workloads.
- No k6 baseline from a CF-region client; current numbers conflate network jitter with app latency.
