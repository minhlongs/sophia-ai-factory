# Deployment Automation Tools Research

## 1. Vercel CLI Automation

### Automation Commands
- **Deploy (Non-interactive):**
  ```bash
  vercel deploy --prod --yes --token $VERCEL_TOKEN
  ```
  - `--yes`: Skips all confirmation prompts.
  - `--prod`: Deploys to production (omit for preview).
  - `--token`: Authenticats via token (avoiding `vercel login`).

- **Environment Sync:**
  ```bash
  vercel env pull .env.production.local --environment=production --yes --token $VERCEL_TOKEN
  ```

- **Build & Deploy (CI/CD Optimized):**
  ```bash
  vercel build --prod --token $VERCEL_TOKEN
  vercel deploy --prebuilt --prod --token $VERCEL_TOKEN
  ```
  *Separates build from upload, useful for caching in CI.*

### Authentication
- **VERCEL_TOKEN:** Create in Vercel Dashboard > Settings > Tokens.
- **OIDC (OpenID Connect):** Recommended for GitHub Actions/GitLab CI.
  - Exchange short-lived CI identity tokens for Vercel access.
  - Removes need for static `VERCEL_TOKEN` secrets.
  - Requires `vercel link` in CI setup or `VERCEL_ORG_ID` and `VERCEL_PROJECT_ID` env vars.

### Requirements
- `vercel.json` configuration file for project settings.
- `VERCEL_ORG_ID` and `VERCEL_PROJECT_ID` env vars for "headless" linking.

---

## 2. Supabase CLI Automation

### Automation Commands
- **Link Project:**
  ```bash
  supabase link --project-ref $SUPABASE_PROJECT_ID --password $DB_PASSWORD --yes
  ```
  - `--yes`: Answers "yes" to prompts (e.g., database changes).

- **Create Project:**
  ```bash
  supabase projects create --org-id $SUPABASE_ORG_ID --db-password $DB_PASSWORD --region us-east-1
  ```
  *Note: Returns JSON with new Project Ref/API keys.*

- **Database Push (Migrations):**
  ```bash
  supabase db push --password $DB_PASSWORD
  ```

### Authentication
- **Environment Variable:** `SUPABASE_ACCESS_TOKEN`
  - Automatically detected by CLI.
  - Generate in Supabase Dashboard > Access Tokens.
- **Database Password:** Often required as a separate argument (`--password` or interactive input) for DB operations, separate from the API token.

### Limitations
- `supabase projects create` is a newer command; verify availability in installed CLI version.
- "Linking" requires the project to exist first.
- Database password management is critical for non-interactive flows (cannot prompt).

---

## 3. Polar.sh Automation

### SDK & API (Primary Method)
Polar.sh automation is best handled via their SDK (`@polar-sh/sdk`) or API, rather than a resource-management CLI.

### Automation Tasks (via TypeScript SDK)

- **Product Creation:**
  ```typescript
  import { Polar } from '@polar-sh/sdk';

  const polar = new Polar({ accessToken: process.env.POLAR_ACCESS_TOKEN });

  async function createProduct() {
    const product = await polar.products.create({
      organizationId: process.env.POLAR_ORG_ID,
      name: "Pro Subscription",
      prices: [{ amountType: 'fixed', priceAmount: 2000, priceCurrency: 'usd' }]
    });
    return product;
  }
  ```

- **Webhook Setup:**
  - configure via API endpoints to register endpoints programmatically.

### Authentication
- **POLAR_ACCESS_TOKEN:** Generate in Polar Settings > Developers.
- **Organization ID:** Required for most operations.

### Requirements
- Node.js script execution environment (e.g., `tsx scripts/setup-polar.ts`).
- `POLAR_ACCESS_TOKEN` in `.env`.

## Summary Strategy for Sophia AI Factory

| Tool | Action | Automation Strategy |
|------|--------|---------------------|
| **Vercel** | Deploy | `vercel deploy --prebuilt --yes` with `VERCEL_ORG/PROJECT_ID` env vars |
| **Supabase** | Infra | `supabase projects create` (capture ID) → `supabase link` |
| **Polar.sh** | Sales | `tsx` script using `@polar-sh/sdk` to sync products |

**Unresolved Questions:**
1. Does `supabase projects create` output JSON that is easily parsable for the next step? (Need to verify output format)
2. Exact Polar SDK method signatures for webhook management (API docs check needed).
