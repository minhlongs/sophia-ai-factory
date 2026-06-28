# Developer Onboarding Guide

Welcome to the **Sophia AI Factory** development team! This guide helps you get started with the codebase structure, development setup, workflow layers, and production systems.

---

## 1. System Architecture & App Layout

The workspace is configured as a partial monorepo. The core production application runs on Cloudflare Workers and is housed inside:
- **Primary Sub-App:** [apps/sophia-ai-factory/](file:///Users/macbook/projects/sophia-ai-factory/apps/sophia-ai-factory/)

### Inactive/Legacy Directories in Workspace
You will find two other folders inside [apps/](file:///Users/macbook/projects/sophia-ai-factory/apps/):
1. [apps/84tea/](file:///Users/macbook/projects/sophia-ai-factory/apps/84tea/) — An unused Next.js template. It does not run in the production environment.
2. [apps/sophia-video-bot/](file:///Users/macbook/projects/sophia-ai-factory/apps/sophia-video-bot/) — A Python Telegram bot prototype containing only a [pyproject.toml](file:///Users/macbook/projects/sophia-ai-factory/apps/sophia-video-bot/pyproject.toml) configuration.
3. [supabase/](file:///Users/macbook/projects/sophia-ai-factory/supabase/) — Legacy PostgreSQL migrations. **Do not use Supabase migrations or clients in new code.** The production database is entirely on Cloudflare D1.

---

## 2. Core 4-Layer Architecture

All production code under [apps/sophia-ai-factory/src/](file:///Users/macbook/projects/sophia-ai-factory/apps/sophia-ai-factory/src/) is structured into 4 layers. Dependencies must flow strictly downward:

$$\text{Land (Business Rules)} \longrightarrow \text{Forest (Orchestrators)} \longrightarrow \text{Tree (Domain Units)} \longrightarrow \text{Seed (Primitives)}$$

- **Seed Layer:** Config and database clients:
  - Database Client shim: [client.ts](file:///Users/macbook/projects/sophia-ai-factory/apps/sophia-ai-factory/src/seed/db/client.ts)
  - Auth Server adapter: [better-auth-server.ts](file:///Users/macbook/projects/sophia-ai-factory/apps/sophia-ai-factory/src/seed/auth/better-auth-server.ts)
  - Config flags: [flags.ts](file:///Users/macbook/projects/sophia-ai-factory/apps/sophia-ai-factory/src/seed/config/flags.ts)
- **Tree Layer:** Reusable domain packages (e.g. payout calculators, auto-handover triggers).
  - Handover service: [auto-handover.ts](file:///Users/macbook/projects/sophia-ai-factory/apps/sophia-ai-factory/src/tree/handover/auto-handover.ts)
- **Forest Layer:** Infrastructure coordination (Inngest event hooks, outbox queues):
  - Inngest client configuration: [client.ts](file:///Users/macbook/projects/sophia-ai-factory/apps/sophia-ai-factory/src/forest/inngest/client.ts)
  - Outbox services under [apps/sophia-ai-factory/src/forest/](file:///Users/macbook/projects/sophia-ai-factory/apps/sophia-ai-factory/src/forest/)
- **Land Layer:** Route files, Next.js layouts, and client pages.
  - Page routers under [apps/sophia-ai-factory/src/land/](file:///Users/macbook/projects/sophia-ai-factory/apps/sophia-ai-factory/src/land/)

---

## 3. Development Prerequisites & Setup

Ensure you have the following installed on your machine:
- Node.js v18 or newer
- wrangler CLI (installed globally or run via `npx wrangler`)
- Fly.io CLI (if deploying or updating FastAPI rendering sidecars)

### Step-by-Step Initial Installation
1. Clone the repository and navigate to the sub-app folder:
   ```bash
   cd apps/sophia-ai-factory
   ```
2. Install npm packages:
   ```bash
   npm install
   ```
3. Run the interactive setup script to configure local environment secrets:
   ```bash
   npm run setup
   ```
   *Note: This executes the CLI setup wizard located in [setup.sh](file:///Users/macbook/projects/sophia-ai-factory/apps/sophia-ai-factory/scripts/setup.sh) which runs [cli-setup.js](file:///Users/macbook/projects/sophia-ai-factory/apps/sophia-ai-factory/scripts/cli-setup.js) to verify API tokens and write them to `.env.local`.*

---

## 4. Local Commands Cheatsheet

Always run commands inside [apps/sophia-ai-factory/](file:///Users/macbook/projects/sophia-ai-factory/apps/sophia-ai-factory/) to avoid root package conflicts.

- **Start Local Server:**
  ```bash
  npm run dev
  ```
- **Execute SQLite Database Migrations (Local D1):**
  ```bash
  npx wrangler d1 migrations apply sophia-raas-db --local
  ```
  *(Migrations reside in the folder [apps/sophia-ai-factory/migrations/](file:///Users/macbook/projects/sophia-ai-factory/apps/sophia-ai-factory/migrations/))*
- **Run Unit Tests (Vitest):**
  ```bash
  npm run test
  ```
  *(Vitest config is located at [vitest.config.ts](file:///Users/macbook/projects/sophia-ai-factory/apps/sophia-ai-factory/vitest.config.ts))*
- **Run Playwright E2E Tests:**
  ```bash
  npm run test:e2e
  ```
- **Typecheck and Code Lint:**
  ```bash
  npm run ci
  ```

---

## 5. Next Steps
- To review existing cron triggers and correct schedule deviations, read the [Technical Debt Audit Guide](file:///Users/macbook/projects/sophia-ai-factory/docs/codebase-audit/TECH_DEBT.md).
- To troubleshoot common developer setups, check [troubleshooting.md](file:///Users/macbook/projects/sophia-ai-factory/docs/troubleshooting.md).
