# Testing Guide

This guide describes how to run, write, and verify tests for the Sophia AI Factory platform. The testing structure comprises three core verification layers: Unit & Integration tests, End-to-End (E2E) browser tests, and Load tests.

---

## 1. Unit & Integration Testing (Vitest)

Unit and integration tests are co-located in `__tests__` directories alongside target modules under `apps/sophia-ai-factory/src/`.

### Configuration
Vitest is configured in `apps/sophia-ai-factory/vitest.config.ts`.

### Execution Commands
* **Run full suite**:
  ```bash
  cd apps/sophia-ai-factory
  pnpm run test
  ```
* **Run in Watch Mode**:
  ```bash
  pnpm run test:watch
  ```
* **Generate Coverage Report**:
  ```bash
  npx vitest run --coverage
  ```

### Mocking Strategy (MSW)
External API responses (such as OpenRouter, ElevenLabs, and D-ID) are intercepted and mocked using Mock Service Worker (MSW) or direct mock adapters to ensure tests remain deterministic and run without API cost.

---

## 2. End-to-End Testing (Playwright)

Playwright E2E tests are located in `apps/sophia-ai-factory/tests/e2e/`. They simulate full user journeys (e.g. Setup Wizard, Dashboard interactions, video configuration).

### Prerequisites
Install Playwright browser packages:
```bash
npx playwright install
```

### Running E2E Tests
1. **Enable Mock AI Mode**: Set `NEXT_PUBLIC_MOCK_AI_SERVICES=true` in `.env.local` to prevent making live external network calls.
2. **Start Dev Server**:
   ```bash
   pnpm run dev
   ```
3. **Execute E2E suite** in a separate terminal:
   ```bash
   pnpm run test:e2e
   ```
4. **Open Playwright Test UI**:
   ```bash
   npx playwright test --ui
   ```

---

## 3. Load Testing (k6)

Load tests evaluate system latency and response times under high concurrent requests, checking the behavior of the SQLite sliding window rate-limiter (`sql-rate-limiter.ts`).

### Running Load Tests
Ensure you have the `k6` binary installed on your host system:
```bash
brew install k6
```
To run the load test:
```bash
cd apps/sophia-ai-factory
k6 run tests/load-test.js
```

---

## 4. Pre-Push Git Gateways

A Git pre-push hook (Husky) prevents pushing commits that do not pass all static and dynamic quality assertions:
1. `npm run ci:typecheck` — Runs TypeScript compiler checks.
2. `npm run ci:lint` — Validates formatting and code linting.
3. `npm run ci:test` — Runs all unit/integration tests.
4. `npm run ci:secrets` — Validates files against credential leaks.
