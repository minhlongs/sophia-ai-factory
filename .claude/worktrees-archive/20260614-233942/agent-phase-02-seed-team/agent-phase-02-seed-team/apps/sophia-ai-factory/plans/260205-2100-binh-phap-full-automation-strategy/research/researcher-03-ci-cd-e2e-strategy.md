# CI/CD & E2E Automation Strategy

## 1. CI/CD Pipeline Architecture (GitHub Actions)

### **Vercel Deployment (OIDC Auth)**
Secure, passwordless deployment using OpenID Connect (OIDC) is the recommended standard.

**Configuration:**
- **Trust Relationship:** Configure Vercel to trust the GitHub repository.
- **Workflow:**
  ```yaml
  permissions:
    id-token: write # Required for OIDC
    contents: read

  steps:
    - name: Install Vercel CLI
      run: npm install --global vercel@latest

    - name: Pull Vercel Environment Information
      run: vercel pull --yes --environment=production --token=${{ secrets.VERCEL_TOKEN }}

    - name: Build Project Artifacts
      run: vercel build --prod --token=${{ secrets.VERCEL_TOKEN }}

    - name: Deploy Project Artifacts to Vercel
      run: vercel deploy --prebuilt --prod --token=${{ secrets.VERCEL_TOKEN }}
  ```
  *Note: While OIDC is best, Vercel still often requires a token for CLI operations in many examples. The "Zero Config" Vercel GitHub Integration is preferred for automatic Preview deployments, while CLI is better for controlled Production releases.*

### **Supabase Migration Automation**
Automate database changes to stay in sync with code.

**Workflow:**
- **Action:** `supabase/setup-cli`
- **Command:** `supabase db push` (for prototyping) or `supabase migration up` (for production).
- **Trigger:** On push to `main` (Production) or Pull Request (Preview databases - advanced).

### **Proposed Pipeline Stages**
1.  **Verification (PR & Push):**
    *   Linting (`npm run lint`)
    *   Type Checking (`npm run type-check`)
    *   Unit Tests (`npm run test`)
2.  **Preview (PR only):**
    *   Vercel Preview Deployment (Auto via Integration)
    *   E2E Tests against Preview URL
3.  **Production (Push to main):**
    *   Supabase Migrations
    *   Vercel Production Deployment
    *   Post-deploy Smoke Tests

## 2. E2E Testing Strategy

### **Tool Selection: Playwright**
**Why Playwright?**
- **Next.js First-Class Support:** Official recommendation from Vercel/Next.js.
- **Server Components:** Better handling of React Server Components (RSC) hydration states compared to Cypress.
- **Speed:** Parallel execution is significantly faster.
- **Trace Viewer:** Superior debugging artifacts (video, console, network) for CI failures.

### **Automation Implementation**
Run tests against the actual built artifact to catch production-only issues (hydration errors, edge edge-cases).

**Workflow Example:**
```yaml
- name: Install Playwright Browsers
  run: npx playwright install --with-deps

- name: Run Playwright Tests
  run: npx playwright test
  env:
    BASE_URL: ${{ github.event.deployment_status.target_url }} # Dynamic URL
```

### **Critical Test Paths (Smoke Tests)**
1.  **Public Pages:** Landing page load, generic asset loading.
2.  **Auth Flow:** Login redirect, session persistence.
3.  **Core Feature:** "Create Campaign" wizard flow (happy path).

## 3. Credential Automation (Zero-Input)

| Component | Credential Source | Automation Method |
|-----------|-------------------|-------------------|
| **Vercel** | `VERCEL_TOKEN` | GitHub Secrets + OIDC Trust |
| **Supabase** | `SUPABASE_ACCESS_TOKEN` | GitHub Secrets + `setup-cli` action |
| **Polar.sh** | `POLAR_ACCESS_TOKEN` | GitHub Secrets + Custom Script |
| **Env Vars** | `.env.production` | Pulled via `vercel env pull` in CI |

## 4. Unresolved Questions
1.  **Preview Databases:** Do we strictly need ephemeral Supabase instances for every PR? (Cost/Complexity trade-off). *Recommendation: Use a shared "Staging" DB for PRs initially to keep automation simple.*
