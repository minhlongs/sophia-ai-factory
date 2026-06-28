# System Configuration & Setup Guide

This guide details the steps required to initialize and configure your local development environment for the **Sophia AI Factory** application.

---

## 1. Local Environment Configuration (`.env.local`)

Sophia AI Factory reads environment variables from `.env.local` inside the sub-app folder [apps/sophia-ai-factory/](file:///Users/macbook/projects/sophia-ai-factory/apps/sophia-ai-factory/).

Ensure that you have populated your `.env.local` file with the following variables:
- `NEXT_PUBLIC_SUPABASE_URL` (Required): Supabase project endpoint URL. Used for JWKS token verification in the RaaS licensing layer and gateway endpoints.
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` (Required): Supabase anonymous client API key.
- `RESEND_API_KEY` (Required): Resend API key for transactional email deliveries.

To simplify configuration of the other service keys, an interactive wizard is provided to guide you through the setup process, validate your keys against external services, and write the verified values directly to your `.env.local` file.

---

## 2. Running the Interactive Setup Wizard

Run the setup wrapper from the root of the sub-app folder:

```bash
cd apps/sophia-ai-factory
./scripts/setup.sh
```

The script wrapper in [setup.sh](file:///Users/macbook/projects/sophia-ai-factory/apps/sophia-ai-factory/scripts/setup.sh) ensures Node.js is available and executes [cli-setup.js](file:///Users/macbook/projects/sophia-ai-factory/apps/sophia-ai-factory/scripts/cli-setup.js).

### Verification Steps Performed by the Wizard:
1. **OpenRouter API Key validation:** Sends a test GET request to `https://openrouter.ai/api/v1/auth/key` using your key in the Authorization header to verify it is valid.
2. **ElevenLabs API Key validation:** Queries `https://api.elevenlabs.io/v1/user/subscription` with the custom `xi-api-key` header to ensure active quota remains.
3. **D-ID API Key validation:** Authenticates against `https://api.d-id.com/credits` using both Basic and Bearer options to confirm credentials are correct.
4. **Airtable Token validation:** Validates Personal Access Tokens against `https://api.airtable.com/v0/meta/whoami` and requests your Airtable Base ID.
5. **Marking configured:** Sets `NEXT_PUBLIC_IS_CONFIGURED="true"`, allowing requests to bypass the initial setup wizard page.

Once all keys are validated, the wizard merges these values into your [apps/sophia-ai-factory/.env.local](file:///Users/macbook/projects/sophia-ai-factory/apps/sophia-ai-factory/.env.local) file (creating it if it does not exist) without overwriting other pre-existing keys.

---

## 3. Database Initialization (Cloudflare D1)

After setting up your environment variables, initialize your local SQLite database:

1. **Verify your local wrangler setup:**
   Make sure wrangler can read the database bindings inside the main worker config: [wrangler.toml](file:///Users/macbook/projects/sophia-ai-factory/apps/sophia-ai-factory/wrangler.toml).
2. **Apply migrations to the local database instance:**
   ```bash
   npx wrangler d1 migrations apply sophia-raas-db --local
   ```
   *Note: This command reads the 151 SQL migration files located under [apps/sophia-ai-factory/migrations/](file:///Users/macbook/projects/sophia-ai-factory/apps/sophia-ai-factory/migrations/) and builds the tables locally.*

---

## 4. Launching the App
Run the local next server:
```bash
npm run dev
```
Open `http://localhost:3000` to access the Sophia Dashboard.
