# Development Guide

This guide provides setup, local testing, coding rules, and contribution workflow details for developers working on the Sophia AI Factory platform.

---

## 1. Quickstart & Local Setup

### System Prerequisites
Ensure your local development environment has the following installed:
- Node.js (version 20 or higher)
- npm (version 10 or higher)
- Cloudflare Wrangler CLI (installed globally via npm)

### Initial Installation
Clone the repository and run the installation at the workspace root:
```bash
git clone git@github.com:agency-os/sophia-ai-factory.git
cd sophia-ai-factory
npm install
```

### Environment Configuration
Copy the template file to configure local credentials:
```bash
cp apps/sophia-ai-factory/.env.example apps/sophia-ai-factory/.env
```
Ensure you set the following environment variables:
- `BETTER_AUTH_SECRET`: Generate a secure random string (e.g. via `openssl rand -hex 32`).
- `BETTER_AUTH_URL`: Configured to `http://localhost:3000` for local dev.

### Running Local Development
1. Start the next dev server with mock services enabled:
   ```bash
   cd apps/sophia-ai-factory
   npm run dev:mock
   ```
2. Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 2. Local Database Mocking

The platform runs on Cloudflare D1 (SQLite at the edge). To make development offline-capable, a D1 Database mock is initialized automatically in development mode.
- **Mock File Location**: [apps/sophia-ai-factory/src/seed/db/local-d1-mock.ts](file:///Users/macbook/projects/sophia-ai-factory/apps/sophia-ai-factory/src/seed/db/local-d1-mock.ts)
- **Local SQLite Cache**: Stored under the gitignored `.next` or local state directory.
- **Applying Migrations Locally**:
  - Run wrangler migrations to apply schemas:
    ```bash
    npx wrangler d1 migrations apply DB --local
    ```

---

## 3. Testing Workflows

### Running Unit & Integration Tests
We use Vitest to execute files ending in `.test.ts` or `.test.tsx`:
```bash
cd apps/sophia-ai-factory
npm run ci:test
```

### Running Typechecks & Linter
Always ensure your code passes static verification before committing:
```bash
# Verify TypeScript compilation compiles clean
npm run ci:typecheck

# Run ESLint validation checks
npm run ci:lint
```

### End-to-End browser Tests (Playwright)
To execute browser interactions:
```bash
npx playwright install
npm run test:e2e
```

---

## 4. Contributing Rules

- **Minimal Change Principle**: Modify only code lines that directly relate to your feature or fix. Unrelated formatting changes should be avoided.
- **Layer Boundary Enforcement**:
  - Never import from outer layers into inner layers.
  - Correct boundary: `seed` -> `tree` -> `forest` -> `land`.
  - Violations must use lazy dynamic imports to break static resolution loops:
    ```typescript
    const { addCredits } = await import('@/lib/mcu/credits-repo');
    ```
- **Commit Messages**: Follow standard conventional commits format (e.g. `feat(auth): add MFA verification steps`).
