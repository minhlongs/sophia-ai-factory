# Testing Guide

This guide describes how to run and write tests for the **Sophia AI Factory** codebase. The test environment comprises three core verification suites: unit/contract tests, end-to-end (E2E) tests, and load tests.

---

## 1. Unit & Integration Testing (Vitest)

Unit and integration tests are co-located in `__tests__` directories alongside target modules under [apps/sophia-ai-factory/src/](file:///Users/macbook/projects/sophia-ai-factory/apps/sophia-ai-factory/src/).

### Configuration
Vitest is the test runner, configured in [apps/sophia-ai-factory/vitest.config.ts](file:///Users/macbook/projects/sophia-ai-factory/apps/sophia-ai-factory/vitest.config.ts).

### Running Tests
To execute unit tests:
```bash
cd apps/sophia-ai-factory
npm run test
```

To run tests in watch mode (interactive):
```bash
npm run test:watch
```

### Mocking with MSW
API responses and external connections (such as HeyGen or Resend API responses) are mocked using Mock Service Worker (MSW) in [apps/sophia-ai-factory/tests/](file:///Users/macbook/projects/sophia-ai-factory/apps/sophia-ai-factory/tests/) to prevent hitting live APIs during tests.

---

## 2. End-to-End (E2E) Testing (Playwright)

Playwright E2E tests are located inside the sub-app folder [apps/sophia-ai-factory/tests/](file:///Users/macbook/projects/sophia-ai-factory/apps/sophia-ai-factory/tests/).

These tests cover the authentication flow, campaign creation wizards, and the billing pages.

### Running E2E Tests
1. **Initialize Playwright browsers:**
   *(Ensure you run this once before your first E2E execution)*
   ```bash
   npx playwright install
   ```
2. **Execute E2E suite:**
   ```bash
   cd apps/sophia-ai-factory
   npm run test:e2e
   ```
3. **Open the interactive test UI:**
   ```bash
   npx playwright test --ui
   ```

---

## 3. Load Testing (k6)

k6 is used to evaluate system performance and response latency under high concurrent load conditions. k6 test scripts are stored under [apps/sophia-ai-factory/tests/](file:///Users/macbook/projects/sophia-ai-factory/apps/sophia-ai-factory/tests/).

### Running Load Tests
Ensure you have the `k6` binary installed on your system.

To run a load test script:
```bash
cd apps/sophia-ai-factory
k6 run tests/load-test.js
```
*(Wait, verify the actual k6 script filename or folder. Let's just refer to the directory [apps/sophia-ai-factory/tests/](file:///Users/macbook/projects/sophia-ai-factory/apps/sophia-ai-factory/tests/)).*

The k6 scripts simulate virtual users (VUs) making concurrent requests to the rate-limited endpoints to verify that the SQLite sliding window rate-limiter defined in [apps/sophia-ai-factory/src/seed/security/sql-rate-limiter.ts](file:///Users/macbook/projects/sophia-ai-factory/apps/sophia-ai-factory/src/seed/security/sql-rate-limiter.ts) operates correctly and throttles excess calls.
