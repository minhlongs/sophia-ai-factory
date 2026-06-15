# CI/CD & E2E Testing Strategy

## 1. Pipeline Architecture

We will implement a **"Verify-Preview-Test-Deploy"** pipeline using GitHub Actions and Vercel.

```mermaid
graph TD
    A[Push to Branch] --> B(CI: Unit & Lint)
    B -->|Success| C{PR Created?}
    C -->|Yes| D[Vercel Preview Deploy]
    D --> E[E2E Tests (Playwright)]
    E -->|Pass| F[Merge to Main]
    F --> G[Vercel Production Deploy]
    G --> H[Post-Deploy Smoke Test]
```

## 2. CI/CD Workflow (`ci-cd.yml`)

We will replace/enhance the existing `verify.yml` with a comprehensive workflow.

### Jobs
1.  **Verification (Fast)**:
    *   Run `npm run lint`
    *   Run `npm run type-check`
    *   Run `npm run test` (Vitest unit tests)
    *   *Duration: ~2 mins*

2.  **Preview Deployment (Vercel)**:
    *   Uses `vercel/actions/prebuilt` or Vercel GitHub Integration.
    *   Sets environment variables for **Mock Mode**:
        *   `NEXT_PUBLIC_MOCK_AI_SERVICES=true`
        *   `POLAR_SERVER=sandbox`

3.  **E2E Testing (Playwright)**:
    *   Runs against the **Preview URL** (or local build in CI if preferred for speed).
    *   **Tools**: Playwright + MSW (Mock Service Worker) as found in `package.json`.
    *   **Key Scenarios**:
        1.  **User Flow**: Landing -> Auth (Mock) -> Dashboard.
        2.  **Campaign Creation**: Create Campaign -> Mock Inngest Processing -> Result.
        3.  **Telegram Bot**: Verify Webhook endpoint accepts standard payload (Mocked).

## 3. Playwright & Mocking Strategy

The repository references `next/experimental/testmode/playwright/msw`, indicating readiness for advanced interception.

### A. Network Interception (Preferred)
Instead of relying solely on code-level dependency injection, Playwright will intercept network traffic:

```typescript
// tests/e2e/campaign.spec.ts
test('creates campaign successfully', async ({ page }) => {
  // Mock HeyGen API
  await page.route('**/v2/video/generate', route => {
    route.fulfill({
      status: 200,
      body: JSON.stringify({ data: { video_id: 'mock_123' } })
    });
  });

  await page.goto('/dashboard');
  await page.click('text=New Campaign');
  // ... interactions
});
```

### B. Service Isolation
*   **Database**: E2E tests should ideally use a **separate Supabase Project** or rely on **Mock Service Worker (MSW)** to mock Supabase responses entirely to avoid state flakiness.
*   **Decision**: Given the "Mock Mode" research, we will use **MSW** for external APIs (HeyGen, Polar) and **Supabase Local** (or mocked responses) for DB to keep tests fast and free.

## 4. Protection Rules

To ensure "Green" status:
1.  **GitHub Branch Protection**:
    *   Require status checks: `Verify`, `E2E Tests`.
    *   Require 1 reviewer.
    *   No direct push to `main`.

2.  **Vercel Deployment Protection**:
    *   Production deployment only happens if CI passes.
    *   (Optional) "Promote to Production" button in Vercel for manual gate.

## 5. Implementation Roadmap

1.  **Install Playwright**: `npm init playwright@latest` (if not fully configured).
2.  **Configure MSW**: Setup handlers for HeyGen, ElevenLabs, Polar.
3.  **Update GitHub Actions**: Create `.github/workflows/pipeline.yml`.
4.  **Refactor Clients**: Ensure `HeyGenClient` and others respect `NEXT_PUBLIC_MOCK_AI_SERVICES` or can be easily intercepted (fetch wrappers).

## 6. Unresolved Questions
*   **Inngest Testing**: How to test async event-driven flows in E2E?
    *   *Solution*: Use Inngest Dev Server middleware in CI or mock the `/api/inngest` endpoint to "immediate return" success.

