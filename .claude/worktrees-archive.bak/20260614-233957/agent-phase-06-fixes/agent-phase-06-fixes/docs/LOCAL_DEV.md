# Local Development Workflow

This document details the workflows, commands, and tools used for local development in the **Sophia AI Factory** project.

---

## 1. Running the Next.js Development Server

To run the Next.js development server locally, navigate to the sub-app folder:

```bash
cd apps/sophia-ai-factory
npm run dev
```

This starts Next.js with hot-reloading. Environmental variables are read from your `.env.local` file (configured via [apps/sophia-ai-factory/scripts/setup.sh](file:///Users/macbook/projects/sophia-ai-factory/apps/sophia-ai-factory/scripts/setup.sh)).

---

## 2. Running wrangler for Database Emulation

Sophia AI Factory uses Cloudflare D1 as its primary SQL database.

- **Check Database Configurations:**
  Bindings and database IDs are declared in [apps/sophia-ai-factory/wrangler.toml](file:///Users/macbook/projects/sophia-ai-factory/apps/sophia-ai-factory/wrangler.toml).
- **Run Local SQL Commands:**
  To check SQLite schemas or inspect local tables, use wrangler:
  ```bash
  npx wrangler d1 execute sophia-raas-db --local --command "SELECT name FROM sqlite_master WHERE type='table';"
  ```
- **Apply New Database Migrations:**
  When schema updates are added to [apps/sophia-ai-factory/migrations/](file:///Users/macbook/projects/sophia-ai-factory/apps/sophia-ai-factory/migrations/), apply them locally:
  ```bash
  npx wrangler d1 migrations apply sophia-raas-db --local
  ```

---

## 3. Running Unit and E2E Tests

### Unit & Integration Testing (Vitest)
Unit tests are co-located within the `src/` directory inside `__tests__` folders. The test runner is Vitest, configured in [apps/sophia-ai-factory/vitest.config.ts](file:///Users/macbook/projects/sophia-ai-factory/apps/sophia-ai-factory/vitest.config.ts).

Run the unit tests:
```bash
npm run test
```

### End-to-End Testing (Playwright)
Playwright E2E tests are located in [apps/sophia-ai-factory/tests/](file:///Users/macbook/projects/sophia-ai-factory/apps/sophia-ai-factory/tests/).

Run the Playwright E2E tests:
```bash
npm run test:e2e
```

---

## 4. Local Inngest Dev Server

Sophia AI Factory relies on Inngest for event-driven asynchronous background jobs.

To run Inngest jobs locally:
1. **Start the Inngest Dev Server:**
   In a separate terminal tab, run:
   ```bash
   npx inngest-cli dev -u http://localhost:3000/api/inngest
   ```
2. **Access the Local Inngest UI:**
   Open `http://localhost:8288` in your browser to view the Inngest Dashboard, send test events, and trace background functions.
3. **Verify Route Registration:**
   If events are not triggered, verify that your function is registered in the serve endpoint: [apps/sophia-ai-factory/src/app/api/inngest/route.ts](file:///Users/macbook/projects/sophia-ai-factory/apps/sophia-ai-factory/src/app/api/inngest/route.ts).

---

## 5. Webhook Emulation (Localhost)

For external APIs (HeyGen, NOWPayments) that send callbacks to webhook endpoints (such as [apps/sophia-ai-factory/src/app/api/webhooks/heygen/route.ts](file:///Users/macbook/projects/sophia-ai-factory/apps/sophia-ai-factory/src/app/api/webhooks/heygen/route.ts)), use a local tunnel tool like `ngrok` or `localtunnel` to expose your port 3000 to the internet:

```bash
ngrok http 3000
```

Update your vendor settings (HeyGen profile, NOWPayments IPN URL) to target the tunnel URL (e.g. `https://your-tunnel-id.ngrok-free.app/api/webhooks/heygen`) during development testing.
