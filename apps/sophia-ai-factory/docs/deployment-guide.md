# Deployment Guide

This guide covers the deployment of the Sophia AI Video Factory. The application is designed to be "Turnkey", meaning most of the complex configuration is handled by the **Setup Wizard** after installation.

## 1. Quick Start (Local Development)

The fastest way to run Sophia AI Factory is locally.

### Prerequisites
- **Node.js**: v18 or higher
- **Git**

### Installation Steps

1. **Clone & Install**
   ```bash
   git clone <repo-url>
   cd sophia-ai-factory
   npm install
   ```

2. **Run Tests (Optional but Recommended)**
   Ensure the application logic is stable before running.
   ```bash
   npm test
   ```

3. **Launch Application**
   ```bash
   npm run dev
   ```

3. **Run the Setup Wizard**
   - Open [http://localhost:3000](http://localhost:3000) in your browser.
   - You will be automatically redirected to the Setup Wizard.
   - Follow the 4-step on-screen instructions to connect your API keys and Database.

   **What you'll need:**
   - **OpenRouter API Key** (for LLM/Scripting)
   - **ElevenLabs API Key** (for Voice)
   - **D-ID API Key** (for Avatar Video)
   - **HeyGen API Key** (for Premium Avatar Video)
   - **Airtable Personal Access Token** (for Database)

   *The Wizard provides direct links to get these keys.*

## 2. Production Deployment (Vercel)

Deploying to the cloud allows you to access your factory from anywhere.

### Step 1: Push to GitHub
Ensure your code is committed and pushed to a GitHub repository.

### Step 2: Import to Vercel
1. Log in to Vercel.
2. Click **"Add New..."** -> **"Project"**.
3. Import your `sophia-ai-factory` repository.

### Step 3: Deployment Configuration
- **Framework Preset**: Next.js (Automatic)
- **Root Directory**: `apps/sophia-ai-factory` (if in a monorepo) or root.
- **Build Command**: `npm run build`

**Environment Variables**:
For the initial deployment, **you do NOT need to set variables**. Deploying with empty variables will trigger the Setup Wizard in production, allowing you to configure it via the UI (note: in production, the Wizard will give you a list of variables to paste into Vercel settings manually for security).

### Step 4: Post-Deployment Setup
1. Visit your deployed URL (e.g., `https://sophia-factory.vercel.app`).
2. Complete the Setup Wizard.
3. Since Vercel is read-only, the Wizard cannot write the `.env` file for you.
   - It will generate a **Configuration Snippet**.
   - Copy this snippet.
   - Go to Vercel Dashboard -> Settings -> Environment Variables.
   - Paste the variables and Save.
   - **Redeploy** your project for changes to take effect.

### Step 5: Production Setup Wizard (CLI)

After deploying, run the interactive production setup wizard to verify connections and configure third-party services (Polar, Telegram, Supabase).

```bash
# Run locally against your production environment credentials
npm run setup:production
```

This wizard will:
1. **Verify Environment Variables**: Checks for missing keys.
2. **Supabase**: Tests connection and verifies required tables exist.
3. **Polar.sh**: Connects to Polar, syncs products (Starter, Growth, Premium), and helps setup webhooks.
4. **Telegram**: Verifies Bot Token and configures the Webhook URL.
5. **Report**: Generates a `production-setup-report.md` with the status of your system.

## 3. Automation Setup (n8n)

The "Brain" of the factory runs on n8n. You need to connect your local/deployed app to an n8n instance.

### Option A: n8n Cloud (Recommended)
1. Sign up for n8n Cloud.
2. Import the workflows from the `workflows/` directory in this project.
3. Activate the workflows.
4. Copy the **Production Webhook URLs**.
5. Add these URLs to your Sophia Factory configuration (via Wizard or .env).

### Option B: Self-Hosted n8n
1. Run n8n using Docker:
   ```bash
   docker run -it --rm --name n8n -p 5678:5678 -v ~/.n8n:/home/node/.n8n n8nio/n8n
   ```
2. Make sure n8n is accessible via a public URL (use a tunnel like `ngrok` if developing locally).
3. Import workflows and configure webhooks.

## 4. Advanced / Manual Configuration

If you prefer to configure manually (skipping the Wizard), create a `.env.local` file with the following:

```bash
# Feature Flags
NEXT_PUBLIC_SETUP_WIZARD=true       # Set to false to disable wizard check
NEXT_PUBLIC_FEATURE_AFFILIATE_ENGINE=true
NEXT_PUBLIC_MOCK_AI_SERVICES=false  # Set to true to use mock services (free, no API keys needed)

# Admin Access (Optional)
ADMIN_USER=admin
ADMIN_PASS=changeme

# Core Integrations
OPENROUTER_API_KEY=sk-or-v1-...
ELEVENLABS_API_KEY=...
DID_API_KEY=...
HEYGEN_API_KEY=...

# Database (Airtable)
AIRTABLE_API_KEY=pat...
AIRTABLE_BASE_ID=app...

# Automation Webhooks (n8n)
N8N_WEBHOOK_GENERATE_SCRIPT=https://...
N8N_WEBHOOK_PUBLISH_VIDEO=https://...

# Payments (Polar)
# Obtained from Polar Dashboard -> Settings
POLAR_ACCESS_TOKEN=polar_at_...
POLAR_ORGANIZATION_ID=...
POLAR_WEBHOOK_SECRET=whsec_...

# Polar Product IDs (Generated via scripts/setup-polar-products.ts)
NEXT_PUBLIC_POLAR_PRODUCT_STARTER=...
NEXT_PUBLIC_POLAR_PRODUCT_GROWTH=...
NEXT_PUBLIC_POLAR_PRODUCT_PREMIUM=...
```

## 6. Automated Deployment & Verification

For enterprise and robust deployments, we rely on scripted automation following the Binh Pháp strategy.

### Infrastructure Sync
The `scripts/infra-sync.sh` script is the master controller for ensuring your environment is correctly set up. It handles:
- Dependency installation
- Environment variable validation
- Database schema verification
- Build artifacts generation

```bash
./scripts/infra-sync.sh
```

### Verification Suite
Before going live, run the full verification suite to ensure system integrity. This runs linting, type checking, unit tests, and security audits.

```bash
./scripts/verify.sh
```

### Mock Mode for Testing
To test the application flow without incurring API costs or requiring external keys, enable Mock Mode. This is used by CI/CD pipelines.

```bash
NEXT_PUBLIC_MOCK_AI_SERVICES=true npm run dev
```

## 7. Troubleshooting

- **Wizard Loops**: If you keep seeing the wizard after setup, check if `NEXT_PUBLIC_SETUP_COMPLETE=true` (or equivalent check in code) is persisting. In Vercel, ensure you Redeployed after setting env vars.
- **API Errors**: Check the `Airtable` connection first. It is the most common point of failure. Ensure the `Base ID` is correct and the Token has `data.records:read` and `data.records:write` scopes.
- **Build Failures**: Run `npm run lint` locally to catch TypeScript errors before pushing.
