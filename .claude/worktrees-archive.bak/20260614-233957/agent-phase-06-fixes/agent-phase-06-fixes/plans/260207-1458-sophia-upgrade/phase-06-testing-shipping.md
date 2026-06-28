# Phase 06: Testing & Shipping

## Context Links

- [Main Plan](./plan.md)
- [Phase 5: Campaign Templates](./phase-05-campaign-templates.md)
- [Playwright Docs](https://playwright.dev)
- [Vercel Deployment](https://vercel.com/docs)

## Overview

**Priority**: P1 (Critical)
**Status**: Pending
**Description**: Implement comprehensive E2E tests with Playwright, write unit tests for critical paths, configure Vercel deployment pipeline, and ship to production.

## Key Insights

- **E2E Testing**: Simulate real user flows in Telegram bot
- **Unit Testing**: Focus on business logic (payments, discovery, campaigns)
- **CI/CD Pipeline**: GitHub Actions → Tests → Vercel deployment
- **Zero-Downtime Deploy**: Blue-green deployment via Vercel
- **Monitoring**: Sentry for errors, Vercel Analytics for performance
- **Rollback Strategy**: Git revert → redeploy previous commit
- **Production Readiness**: All Binh Pháp quality gates must pass

## Requirements

### Functional Requirements
- E2E tests for all user flows (subscribe, discover, campaign, export)
- Unit tests for critical services (payments, AI, exports)
- Integration tests for API endpoints
- Webhook testing (Polar.sh, Telegram)
- Performance tests (load testing)
- Error tracking setup (Sentry)
- Analytics setup (Vercel Analytics)
- Deployment automation (GitHub Actions)
- Production environment variables
- Rollback procedure documentation

### Non-Functional Requirements
- Test coverage > 80%
- E2E test execution time < 5 minutes
- Build time < 10s (Binh Pháp requirement)
- Zero TypeScript errors
- Zero ESLint warnings
- Lighthouse score > 90
- Vercel deployment time < 2 minutes

## Architecture

```
tests/
├── e2e/
│   ├── bot/
│   │   ├── subscribe-flow.spec.ts        # Subscription flow
│   │   ├── discover-flow.spec.ts         # Discovery flow
│   │   ├── campaign-flow.spec.ts         # Campaign flow
│   │   └── export-flow.spec.ts           # Export flow
│   ├── api/
│   │   ├── webhooks.spec.ts              # Webhook endpoints
│   │   ├── discovery.spec.ts             # Discovery API
│   │   └── campaigns.spec.ts             # Campaign API
│   └── fixtures/
│       ├── mock-telegram-update.ts       # Telegram message mocks
│       ├── mock-polar-event.ts           # Polar.sh event mocks
│       └── mock-trend-data.ts            # Trend data mocks
├── unit/
│   ├── payments/
│   │   ├── polar-webhook-handler.test.ts
│   │   ├── pricing-calculator.test.ts
│   │   └── subscription-service.test.ts
│   ├── discovery/
│   │   ├── trend-detector.test.ts
│   │   ├── trend-scorer.test.ts
│   │   └── api-rate-limiter.test.ts
│   ├── campaigns/
│   │   ├── campaign-generator.test.ts
│   │   ├── template-engine.test.ts
│   │   └── pdf-exporter.test.ts
│   └── bot/
│       ├── session-middleware.test.ts
│       └── keyboard-builder.test.ts
└── integration/
    ├── database-operations.test.ts
    ├── redis-state.test.ts
    └── api-endpoints.test.ts

.github/workflows/
├── ci.yml                                # Run tests on PR
└── deploy.yml                            # Deploy to Vercel on merge

Monitoring:
├── Sentry (error tracking)
├── Vercel Analytics (performance)
└── Uptime monitoring (healthchecks.io)
```

**CI/CD Pipeline**:
```
GitHub Push → GitHub Actions → Run Tests → Build → Deploy to Vercel
                                ↓
                         If tests fail: Block deploy
                         If tests pass: Auto-deploy
```

## Related Code Files

### Files to Create
- `tests/e2e/bot/subscribe-flow.spec.ts` - E2E subscription test
- `tests/e2e/bot/discover-flow.spec.ts` - E2E discovery test
- `tests/e2e/bot/campaign-flow.spec.ts` - E2E campaign test
- `tests/e2e/bot/export-flow.spec.ts` - E2E export test
- `tests/e2e/api/webhooks.spec.ts` - Webhook integration tests
- `tests/e2e/api/discovery.spec.ts` - Discovery API tests
- `tests/e2e/api/campaigns.spec.ts` - Campaign API tests
- `tests/e2e/fixtures/mock-telegram-update.ts` - Test fixtures
- `tests/e2e/fixtures/mock-polar-event.ts` - Test fixtures
- `tests/e2e/fixtures/mock-trend-data.ts` - Test fixtures
- `tests/unit/payments/*.test.ts` - 3 unit tests
- `tests/unit/discovery/*.test.ts` - 3 unit tests
- `tests/unit/campaigns/*.test.ts` - 3 unit tests
- `tests/unit/bot/*.test.ts` - 2 unit tests
- `tests/integration/*.test.ts` - 3 integration tests
- `.github/workflows/ci.yml` - CI pipeline
- `.github/workflows/deploy.yml` - Deployment pipeline
- `playwright.config.ts` - Playwright configuration
- `jest.config.js` - Jest configuration
- `vitest.config.ts` - Vitest configuration (alternative)
- `sentry.client.config.ts` - Sentry setup
- `sentry.server.config.ts` - Sentry server setup

### Files to Modify
- `package.json` - Add test scripts and dependencies
- `next.config.ts` - Add Sentry, analytics config
- `vercel.json` - Add environment variables, cron jobs

## Implementation Steps

1. **Install Testing Dependencies**
   ```bash
   npm install -D @playwright/test jest @testing-library/react \
     @testing-library/jest-dom vitest @vitest/ui
   npm install @sentry/nextjs @vercel/analytics
   ```

2. **Configure Playwright**
   - Create `playwright.config.ts`
   - Setup test browser (Chromium)
   - Configure baseURL, timeout, retries
   - Enable trace on failure

3. **Configure Jest/Vitest**
   - Create `jest.config.js` or `vitest.config.ts`
   - Setup test environment (jsdom)
   - Configure module aliases
   - Enable coverage reporting

4. **Write E2E Tests**

   **Subscribe Flow**:
   ```typescript
   // tests/e2e/bot/subscribe-flow.spec.ts
   test('user can subscribe and access premium commands', async ({ page }) => {
     // 1. Send /start to bot
     await page.goto('https://t.me/sophia_ai_bot?start=test');

     // 2. Click subscribe button
     await page.click('text=Subscribe');

     // 3. Complete payment (mock)
     await mockPolarWebhook({ event: 'subscription.created' });

     // 4. Verify access granted
     await page.click('text=/discover');
     await expect(page.locator('text=Top Trends')).toBeVisible();
   });
   ```

   **Discovery Flow**:
   ```typescript
   // tests/e2e/bot/discover-flow.spec.ts
   test('user can discover trends with filters', async ({ page }) => {
     await authenticateUser(page);

     await page.click('text=/discover');
     await page.click('text=Tech');
     await page.click('text=US');

     await expect(page.locator('.trend-item')).toHaveCount(10);
   });
   ```

   **Campaign Flow**:
   ```typescript
   // tests/e2e/bot/campaign-flow.spec.ts
   test('user can generate and export campaign', async ({ page }) => {
     await authenticateUser(page);

     // Select trend
     await page.click('.trend-item >> nth=0');

     // Select template
     await page.click('text=Twitter Thread');

     // Wait for generation
     await expect(page.locator('text=Campaign generated')).toBeVisible();

     // Export as PDF
     await page.click('text=Export as PDF');
     const download = await page.waitForEvent('download');
     expect(download.suggestedFilename()).toContain('.pdf');
   });
   ```

5. **Write Unit Tests**

   **Payment Service**:
   ```typescript
   // tests/unit/payments/subscription-service.test.ts
   describe('SubscriptionService', () => {
     it('creates subscription successfully', async () => {
       const sub = await subscriptionService.create({
         userId: 123,
         polarSubId: 'sub_abc',
         planId: 'plan_pro'
       });
       expect(sub).toHaveProperty('id');
       expect(sub.status).toBe('active');
     });

     it('validates active subscription', async () => {
       const isActive = await subscriptionService.isActive(123);
       expect(isActive).toBe(true);
     });
   });
   ```

   **Trend Scorer**:
   ```typescript
   // tests/unit/discovery/trend-scorer.test.ts
   describe('TrendScorer', () => {
     it('calculates score correctly', () => {
       const score = trendScorer.calculate({
         engagement: 1000,
         sentiment: 0.8,
         velocity: 50
       });
       expect(score).toBeGreaterThan(0);
       expect(score).toBeLessThanOrEqual(100);
     });
   });
   ```

   **Template Engine**:
   ```typescript
   // tests/unit/campaigns/template-engine.test.ts
   describe('TemplateEngine', () => {
     it('renders template with variables', () => {
       const template = 'Hello {{name}}!';
       const result = templateEngine.render(template, { name: 'World' });
       expect(result).toBe('Hello World!');
     });

     it('extracts variables from template', () => {
       const template = '{{title}} - {{author}}';
       const vars = templateEngine.extractVariables(template);
       expect(vars).toEqual(['title', 'author']);
     });
   });
   ```

6. **Write Integration Tests**
   ```typescript
   // tests/integration/api-endpoints.test.ts
   describe('API Endpoints', () => {
     it('POST /api/campaigns/generate returns campaign', async () => {
       const response = await fetch('/api/campaigns/generate', {
         method: 'POST',
         body: JSON.stringify({
           trendId: 'trend_123',
           templateId: 'template_456',
           userId: 789
         })
       });
       const data = await response.json();
       expect(data.campaign).toBeDefined();
       expect(data.campaign.status).toBe('draft');
     });
   });
   ```

7. **Setup Sentry**
   ```bash
   npx @sentry/wizard@latest -i nextjs
   ```
   - Configure error tracking
   - Add source maps upload
   - Set environment (production/staging)

8. **Setup Vercel Analytics**
   ```typescript
   // app/layout.tsx
   import { Analytics } from '@vercel/analytics/react';

   export default function RootLayout({ children }) {
     return (
       <html>
         <body>
           {children}
           <Analytics />
         </body>
       </html>
     );
   }
   ```

9. **Create GitHub Actions CI Pipeline**
   ```yaml
   # .github/workflows/ci.yml
   name: CI
   on: [pull_request]

   jobs:
     test:
       runs-on: ubuntu-latest
       steps:
         - uses: actions/checkout@v3
         - uses: actions/setup-node@v3
           with:
             node-version: 18
         - run: npm ci
         - run: npm run lint
         - run: npm run test:unit
         - run: npm run test:e2e
         - run: npm run build
   ```

10. **Create Deployment Pipeline**
    ```yaml
    # .github/workflows/deploy.yml
    name: Deploy
    on:
      push:
        branches: [main]

    jobs:
      deploy:
        runs-on: ubuntu-latest
        steps:
          - uses: actions/checkout@v3
          - uses: amondnet/vercel-action@v20
            with:
              vercel-token: ${{ secrets.VERCEL_TOKEN }}
              vercel-org-id: ${{ secrets.VERCEL_ORG_ID }}
              vercel-project-id: ${{ secrets.VERCEL_PROJECT_ID }}
              vercel-args: '--prod'
    ```

11. **Configure Vercel Environment**
    - Add all environment variables in Vercel dashboard
    - Setup production database connections
    - Configure custom domain
    - Enable HTTPS
    - Setup preview deployments

12. **Run Quality Gates (Binh Pháp)**
    ```bash
    # 始計 - Tech Debt
    grep -r "console\." src --include="*.ts" --include="*.tsx" | wc -l  # = 0
    grep -r "TODO\|FIXME" src | wc -l  # = 0

    # 作戰 - Type Safety
    grep -r ": any" src --include="*.ts" --include="*.tsx" | wc -l  # = 0
    npm run type-check  # 0 errors

    # 謀攻 - Performance
    npm run build  # < 10s

    # 軍形 - Security
    npm audit --audit-level=high  # 0 vulnerabilities

    # 虛實 - Documentation
    # Verify all docs updated
    ```

13. **Deploy to Production**
    ```bash
    # Final checks
    npm run test:all
    npm run build
    npm run lint

    # Deploy
    git push origin main  # Auto-deploys via GitHub Actions
    ```

14. **Post-Deployment Verification**
    - Test bot in production Telegram
    - Verify all webhooks working (Polar.sh, Telegram)
    - Check Sentry for errors
    - Monitor Vercel Analytics
    - Test subscription flow end-to-end
    - Test discovery and campaign generation
    - Verify exports download correctly

15. **Setup Monitoring & Alerts**
    - Sentry: Alert on error rate > 1%
    - Vercel: Alert on build failures
    - Uptime: Alert on downtime > 1 minute
    - Polar.sh: Alert on webhook failures

## Todo List

- [ ] Install Playwright, Jest, Sentry dependencies
- [ ] Configure Playwright test runner
- [ ] Configure Jest/Vitest for unit tests
- [ ] Write E2E test: Subscribe flow
- [ ] Write E2E test: Discovery flow
- [ ] Write E2E test: Campaign flow
- [ ] Write E2E test: Export flow
- [ ] Write unit tests: Payment service (3 tests)
- [ ] Write unit tests: Discovery engine (3 tests)
- [ ] Write unit tests: Campaign generator (3 tests)
- [ ] Write unit tests: Bot middleware (2 tests)
- [ ] Write integration tests: API endpoints (3 tests)
- [ ] Setup Sentry error tracking
- [ ] Setup Vercel Analytics
- [ ] Create GitHub Actions CI pipeline
- [ ] Create deployment pipeline
- [ ] Configure Vercel production environment
- [ ] Run all Binh Pháp quality gates
- [ ] Fix all TypeScript errors
- [ ] Fix all ESLint warnings
- [ ] Achieve test coverage > 80%
- [ ] Deploy to Vercel production
- [ ] Verify bot works in production
- [ ] Verify webhooks working
- [ ] Setup monitoring alerts
- [ ] Document rollback procedure

## Success Criteria

- [x] All E2E tests pass (subscribe, discover, campaign, export)
- [x] All unit tests pass (payments, discovery, campaigns)
- [x] Test coverage > 80%
- [x] Build time < 10s (Binh Pháp)
- [x] Zero TypeScript errors
- [x] Zero ESLint warnings
- [x] Zero `console.log` statements
- [x] Zero `TODO/FIXME` comments
- [x] Zero high/critical npm vulnerabilities
- [x] Sentry configured and receiving events
- [x] Vercel Analytics tracking page views
- [x] GitHub Actions CI/CD pipeline working
- [x] Production deployment successful
- [x] All webhooks verified working
- [x] Bot responds in production Telegram
- [x] Monitoring alerts configured

## Risk Assessment

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| E2E tests flaky (timing issues) | High | Medium | Add explicit waits, increase timeouts |
| Production webhook failures | Medium | High | Monitor webhook delivery, setup retries |
| Deployment rollback needed | Low | High | Document rollback procedure, test in staging |
| Test coverage insufficient | Medium | Medium | Focus on critical paths, set coverage threshold |
| Sentry quota exceeded | Low | Low | Set rate limits, sample errors |
| Performance degradation | Medium | Medium | Load test before deploy, monitor metrics |

## Security Considerations

- **Environment Variables**: Never commit to git, use Vercel secrets
- **API Keys**: Rotate keys regularly, use read-only keys where possible
- **Error Messages**: Sanitize sensitive data before logging to Sentry
- **Webhooks**: Always verify signatures before processing
- **Rate Limiting**: Enforce limits on all API endpoints
- **HTTPS**: Enforce HTTPS on all endpoints

## Rollback Procedure

If production issues occur:

1. **Immediate**: Revert to previous Vercel deployment via dashboard
2. **Git Revert**:
   ```bash
   git revert HEAD
   git push origin main
   ```
3. **Notify Users**: Send message to all active users about maintenance
4. **Investigate**: Check Sentry errors, Vercel logs
5. **Fix**: Create hotfix branch, deploy to staging
6. **Test**: Run full E2E suite
7. **Deploy**: Merge to main, auto-deploy

## Next Steps

After Phase 6 completion:
1. **Production Launch**: Bot is live and accessible
2. **User Onboarding**: Send announcement to early access list
3. **Monitor Metrics**: Track subscriptions, discovery usage, campaigns created
4. **Iterate**: Collect user feedback, plan next features
5. **Scale**: Monitor performance, optimize as needed
6. **Revenue Tracking**: Monitor Polar.sh dashboard for MRR growth

## Final Checklist

- [ ] All 6 phases completed
- [ ] All tests passing (E2E + Unit + Integration)
- [ ] All Binh Pháp quality gates passed
- [ ] Production deployment verified
- [ ] Monitoring and alerts configured
- [ ] Documentation updated
- [ ] Rollback procedure tested
- [ ] Ready for $1M ARR journey! 🚀
