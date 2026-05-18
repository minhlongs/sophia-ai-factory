# Phase 08 — Load Test + Playwright E2E Magic Link

## Context Links
- Brainstorm: [reports/brainstorm.md](reports/brainstorm.md) §6 D3, §9 Q4
- Staging URL: from Phase 02
- Redeem page: `src/app/[locale]/redeem/page.tsx` + `redeem-page-client.tsx`
- Handover flow: `src/tree/handover/`
- Telegram notifier: `src/tree/telegram/telegram-handover-notifier.ts`
- Magic link 72h: per handover spec

## Overview
- **Priority:** P0 (compliance-grade requirement)
- **Status:** pending (unblocked 2026-05-18 via Phase 02 staging deploy)
- **Duration:** ~1 day (D9)
- **Brief:** k6 load tests on `/redeem` + `/dashboard` at 100 concurrent users. Playwright E2E covering FREE100-XXXX bulk-generate → redeem → magic-link → auto-signup → tier=master → Starter SOP installed → Telegram called. Manual browser Rule 13 verify on PROD for all 4 tier checkouts.

## Key Insights
- Load test target = STAGING (not PROD) per brainstorm risk register
- k6 supports thresholds + ramps; produce HTML report
- Playwright already in `tests/e2e/` (config exists)
- Magic link 72h flow: redeem → email sent → token → /magic-link/[token] → session created
- For E2E, intercept or fake email adapter to capture token

## Requirements
**Functional (load):**
- k6 script: 100 VUs hit /redeem with unique FREE100-XXXX codes over 5 min
- k6 script: 100 VUs browse /dashboard
- Targets: p95 latency < 500ms, error rate < 1%, no D1 throttle

**Functional (E2E):**
- Generate FREE100-XXXX via admin endpoint
- POST to /redeem with code + email
- Capture magic-link token (test email adapter or interceptor)
- Visit /magic-link/[token]
- Assert: user created, tier=MASTER, Starter SOP auto-installed, Telegram notifier called

**Manual (PROD Rule 13):**
- Open 4 checkout flows (BASIC, PREMIUM, ENTERPRISE, MASTER)
- Verify each redirects to NOWPayments
- FREE100-XXXX redemption flow on PROD with disposable code

**Non-functional:**
- Load test reports saved to `docs/load-test-260523.md` with HTML attached
- E2E test deterministic + repeatable
- Manual Rule 13 documented with screenshots

## Architecture
```
k6 (local) ──HTTPS──→ STAGING Worker ──→ Staging D1
                                       └→ Staging R2

Playwright (local) ──HTTPS──→ STAGING Worker
                                ├→ Staging D1
                                ├→ Mock email adapter (env var)
                                └→ Mock Telegram (env var)
```

## Related Code Files
**Create:**
- `tests/load/redeem-flow.js` (k6)
- `tests/load/dashboard-browse.js` (k6)
- `tests/e2e/free100-magic-link.spec.ts` (Playwright)
- `tests/e2e/helpers/admin-login.ts` (Playwright helper)
- `tests/e2e/helpers/intercept-email.ts` (mock email capture)
- `docs/load-test-260523.md`

**Modify:**
- `playwright.config.ts` (add staging URL profile if missing)
- `src/seed/email/adapter.ts` or similar (add `FAKE_EMAIL_ADAPTER` env flag for E2E)

**Delete:** none

## Implementation Steps

### 1. Install k6
```bash
brew install k6 || true
k6 version
```

### 2. Pre-generate FREE100 codes for load test
```bash
# Use admin endpoint to generate 200 codes for the test pool
curl -X POST "$STAGING_URL/api/admin/promo-codes/bulk-generate" \
  -H "Cookie: <admin>" -H "Content-Type: application/json" \
  -d '{"baseCode":"FREE100","count":200,"tier":"master","description":"load-test-260523"}' \
  | jq -r '.codes[]' > /tmp/load-test-codes.txt
wc -l /tmp/load-test-codes.txt  # expect 200
```

### 3. k6 redeem script
```js
// tests/load/redeem-flow.js
import http from 'k6/http';
import { check, sleep } from 'k6';
import { SharedArray } from 'k6/data';

const codes = new SharedArray('codes', () => open('/tmp/load-test-codes.txt').split('\n').filter(Boolean));

export const options = {
  scenarios: {
    redeem: {
      executor: 'ramping-vus',
      stages: [
        { duration: '1m', target: 50 },
        { duration: '3m', target: 100 },
        { duration: '1m', target: 0 },
      ],
    },
  },
  thresholds: {
    http_req_duration: ['p(95)<500'],
    http_req_failed:   ['rate<0.01'],
  },
};

export default function () {
  const code = codes[Math.floor(Math.random() * codes.length)];
  const email = `load-${__VU}-${__ITER}-${Date.now()}@test.example`;
  const res = http.post(`${__ENV.STAGING_URL}/api/promo/redeem`, JSON.stringify({ code, email }), {
    headers: { 'Content-Type': 'application/json' },
  });
  check(res, { '200 or 409': r => r.status === 200 || r.status === 409 });
  sleep(0.5);
}
```

### 4. k6 dashboard script
Similar shape, GET `/dashboard` with valid session cookie (preload via setup).

### 5. Run load tests
```bash
STAGING_URL="https://sophia-ai-factory-staging.<account>.workers.dev" \
  k6 run --out html=tests/load/redeem-report.html tests/load/redeem-flow.js | tee /tmp/k6-redeem.log
STAGING_URL=... k6 run --out html=tests/load/dashboard-report.html tests/load/dashboard-browse.js
```

### 6. Document load results
```md
# docs/load-test-260523.md
## Redeem
- VUs: 100 peak
- Duration: 5min
- Total requests: <N>
- p50/p95/p99: <ms>
- Error rate: <%>
- D1 throttle errors: <count>
- Thresholds met: ✅/❌

## Dashboard
<same shape>

## Conclusions
- Capacity headroom: <X>x current load
- Bottlenecks: <none / list>
```

### 7. Add email mock adapter (E2E only)
```ts
// src/seed/email/adapter.ts
export function sendEmail(to: string, subject: string, html: string) {
  if (process.env.FAKE_EMAIL_ADAPTER === '1') {
    // write to KV / in-memory store
    return mockStore.append({ to, subject, html, sentAt: Date.now() });
  }
  // real path
}
```
Staging env sets `FAKE_EMAIL_ADAPTER=1`. Tests read via `/api/_test/last-email?to=<email>`.

### 8. Playwright E2E
```ts
// tests/e2e/free100-magic-link.spec.ts
import { test, expect } from '@playwright/test';
import { adminLogin } from './helpers/admin-login';
import { getLastEmail } from './helpers/intercept-email';

test('FREE100 redeem → magic link → master tier + Starter SOP installed', async ({ page, request }) => {
  // 1. Admin generates code
  const adminCtx = await adminLogin(request);
  const gen = await adminCtx.post('/api/admin/promo-codes/bulk-generate', {
    data: { baseCode: 'FREE100', count: 1, tier: 'master', description: 'e2e magic-link' },
  });
  const { codes } = await gen.json();
  const code = codes[0];

  // 2. Redeem via /redeem page
  const email = `e2e-${Date.now()}@test.example`;
  await page.goto('/en/redeem');
  await page.fill('input[name=code]', code);
  await page.fill('input[name=email]', email);
  await page.click('button[type=submit]');
  await expect(page.getByText(/check your email/i)).toBeVisible();

  // 3. Extract magic-link token
  const lastEmail = await getLastEmail(email);
  const match = lastEmail.html.match(/\/magic-link\/([a-zA-Z0-9_-]+)/);
  expect(match).toBeTruthy();
  const token = match![1];

  // 4. Visit magic link
  await page.goto(`/en/magic-link/${token}`);
  await expect(page).toHaveURL(/\/dashboard/);

  // 5. Verify tier
  const tierRes = await request.get('/api/user/tier');
  expect((await tierRes.json()).tier).toBe('MASTER');

  // 6. Verify Starter SOP auto-installed
  const sopRes = await request.get('/api/sops/installed');
  const sops = await sopRes.json();
  expect(sops.find((s: any) => s.kind === 'starter')).toBeTruthy();

  // 7. Verify Telegram notifier called (mock store)
  const tgRes = await request.get('/api/_test/telegram-log');
  const tgLog = await tgRes.json();
  expect(tgLog.find((m: any) => m.payload.includes(email))).toBeTruthy();
});
```

### 9. Run E2E
```bash
STAGING_URL=... npx playwright test tests/e2e/free100-magic-link.spec.ts --reporter=html
```

### 10. Manual Rule 13 verification on PROD
- Open https://sophia.agencyos.network in incognito
- For each tier (BASIC/PREMIUM/ENTERPRISE/MASTER): click checkout → confirm NOWPayments redirect → screenshot
- Redeem 1 disposable FREE100-XXXX code on PROD → confirm tier granted → screenshot
- Document in `plans/260517-2223-sophia-free100-handover/reports/rule13-260523.md`

## Todo List
- [ ] Install k6
- [ ] Pre-generate 200 codes on staging
- [ ] Write k6 redeem script
- [ ] Write k6 dashboard script
- [ ] Run both load tests → HTML reports
- [ ] Document results in `docs/load-test-260523.md`
- [ ] Add `FAKE_EMAIL_ADAPTER=1` mock path
- [ ] Write Playwright E2E magic-link test
- [ ] Run E2E → green
- [ ] Manual Rule 13 PROD checkouts × 4 tiers + screenshots
- [ ] Document Rule 13 in `reports/rule13-260523.md`

## Success Criteria
- Load test p95 < 500ms @ 100 concurrent, error rate < 1%
- No D1 throttle errors in k6 logs
- Playwright E2E test passes on staging
- All 4 PROD tier checkouts redirect to NOWPayments
- FREE100-XXXX PROD redemption succeeds end-to-end
- All artifacts saved to `docs/` + plan reports

## Risk Assessment
| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Load test triggers CF rate limit | Med | Med | Allowlist test IP; throttle to 100 VUs not 1000 |
| Staging D1 hits write throttle | Med | High | Use idempotent redeem (409 expected on dup) so reads dominate |
| Email mock adapter leaks into PROD | Critical | Critical | Guard with `process.env.NODE_ENV !== 'production'` + secret env flag |
| Playwright flaky on auth race | Med | Med | Use `waitFor` + retries; staging perf is stable post-Phase 06 |
| PROD checkout fails mid-Rule-13 | Med | Critical | Block sign-off; debug payment integration; do NOT proceed to Phase 10 |
| Magic link token leak in mock store | Low | Med | Mock store only on staging; auto-clear after each test |

## Security Considerations
- Mock email adapter NEVER active on PROD (env flag + NODE_ENV check)
- Load test uses disposable email addresses
- 200 codes pre-generated for test pool marked with `description='load-test-260523'` for cleanup
- After phase: cleanup test data with `DELETE FROM promo_codes WHERE description = 'load-test-260523'`
- Playwright runs against staging only

## Next Steps
- Phase 09 (handover docs) references load test + E2E results
- Phase 10 final sign-off requires manual Rule 13 docs + load report
- After Phase 10, prune load-test promo rows from staging
