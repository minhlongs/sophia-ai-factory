# Sophia AI Factory — Quick Start Guide

Welcome to the Sophia AI Factory repository! This guide will get you up and running with a local development server in 5 minutes and ready for deploying in 10.

---

## 1. Prerequisites

Before setting up, make sure your environment has the following installed:
- **Node.js**: Version 18.0.0 or higher (version 20+ is recommended)
- **pnpm**: Version 8.0.0 or higher (preferred package manager)
- **Cloudflare Wrangler CLI**: Installed globally via `npm install -g wrangler`
- **Cloudflare Account**: For production deployment (authenticated via `wrangler login`)

---

## 2. Local Setup (5-Minute Workflow)

Follow these steps to run a local instance of the application:

```bash
# 1. Clone the repository and navigate into the app directory
git clone https://github.com/longtho638-jpg/sophia-ai-factory.git
cd sophia-ai-factory/apps/sophia-ai-factory

# 2. Install dependencies
pnpm install

# 3. Initialize local environment variables
cp .env.example .env.local
```

### Configure Environment Variables
Open the `.env.local` file and verify or configure the following settings:
* **Mock Mode**: `NEXT_PUBLIC_MOCK_AI_SERVICES=true` (forces the app to use mock AI providers, which bypasses the need for paid keys during basic testing).
* **Better Auth Secret**: `BETTER_AUTH_SECRET=a_secure_random_string_of_at_least_32_characters` (generate using `openssl rand -hex 32` if needed).
* **Better Auth URL**: `BETTER_AUTH_URL=http://localhost:3000`

### Start Development Services
Run the Next.js development server:
```bash
pnpm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser. The application runs with a local SQLite database in memory by default.

---

## 3. Local Development Mode Behavior

When running in local development mode:
- **Database**: SQLite in-memory database is used. No tables persist across restarts.
- **AI Services**: Mocked using mock service adapters (e.g. returning instant, pre-generated video links or scripts) unless you set `NEXT_PUBLIC_MOCK_AI_SERVICES=false` and provide active API keys.
- **Crons**: Background schedulers are disabled unless manually triggered.
- **Telegram Bot Webhooks**: Telegram bot webhooks to `@Sophia_Bbot` are offline locally since there is no public HTTPS tunnel.

---

## 4. Production Deployment (10-Minute Workflow)

To deploy to Cloudflare Pages/Workers, run the following verification checks and deploy commands:

```bash
# 1. Static checks and local builds
pnpm run type-check
pnpm run build

# 2. Run the test suite
pnpm run ci:test

# 3. Push your commits to Git
git push origin main

# 4. Trigger the Cloudflare deployment
pnpm run deploy:full

# 5. Apply database migrations to production D1
pnpm run deploy:migrations
```

### Verification
Verify that the deployed revision matches your local repository commit SHA:
```bash
LOCAL_SHA=$(git rev-parse HEAD | cut -c1-8)
LIVE_SHA=$(curl -s https://sophia.agencyos.network/api/version | jq -r .shortSha)
echo "Local: $LOCAL_SHA  Live: $LIVE_SHA"
```

---

## 5. Local CI Gates

The repository contains a pre-push hook (located at `.husky/pre-push`) that enforces the following criteria:

| Gate | Validation Command | Required status |
|---|---|---|
| G1 | `npm run ci:typecheck` | Must Pass |
| G2 | `npm run ci:lint` | Must Pass |
| G3 | `npm run ci:test` | Must Pass |
| G4 | `npm run ci:secrets` | Must Pass |
| G5 | `npm audit --audit-level=high` | Informational only |

---

## 6. Common Troubleshooting Items

1. **Memory Allocation Issues during Next.js build**:
   If the build runs out of memory, execute using increased node options:
   `NODE_OPTIONS=--max-old-space-size=14336 pnpm run build`
2. **Database Migrations failed on deploy**:
   Verify wrangler credentials by running `npx wrangler whoami`. Ensure you have write access to `sophia-raas-db`.
