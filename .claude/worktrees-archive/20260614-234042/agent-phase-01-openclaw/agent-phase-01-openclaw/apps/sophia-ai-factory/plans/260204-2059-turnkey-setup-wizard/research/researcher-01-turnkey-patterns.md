# Turnkey Setup Wizard Research Report

**Date:** 2026-02-04
**Focus:** Non-technical user setup patterns for Next.js applications
**Context:** Sophia AI Factory (Next.js 16, React 19)

## 1. Environment Variable Setup UI Patterns (No-CLI)

For self-hosted Next.js apps targeting non-technical users, the standard `.env` file editing workflow is a major friction point.

*   **Runtime Configuration Strategy**: instead of build-time env vars, use runtime configuration. Next.js `publicRuntimeConfig` or a custom `getConfig()` utility reading from a writable file (e.g., `config.json` or `.env.local` managed by the app).
*   **The "First Run" Middleware**: Middleware checks for the existence of a configuration file or a specific "setup complete" flag. If missing, it redirects ALL traffic to `/setup`.
*   **API-Based Writer**: A secure API route (`POST /api/setup/save`) that writes inputs to the server's `.env.local` or configuration database.
    *   *Security Note*: This route must be protected or only active during the setup phase. Once setup is complete, the route should disable itself or require high-level auth.

## 2. API Key Validation & Testing Patterns

**Never validate keys solely on the client-side** (e.g., direct calls to OpenAI from browser) to avoid CORS issues and leaking usage patterns.

*   **Proxy Validation Pattern**:
    1.  User inputs API Key.
    2.  Frontend sends key to internal endpoint: `/api/verify-service?service=openai`.
    3.  Backend temporarily uses the key to make a minimal "list models" or "get user" request to the third-party provider.
    4.  Backend returns `valid: true/false` and metadata (e.g., "Connected as User X").
*   **Real-Time Feedback**: Use a "Verify" button next to the input field. Do not allow proceeding to the next step until the key is verified.

## 3. User-Friendly Error Messages

Avoid raw API errors. Map status codes to human-readable instructions.

| Error Code | Raw Message | Friendly Message |
| :--- | :--- | :--- |
| 401 | `Invalid Authentication` | "The API key you entered is incorrect. Please check for extra spaces." |
| 429 | `Rate Limit Exceeded` | "This key has hit its usage limits. Please check your billing status." |
| 500 | `Internal Server Error` | "The service is temporarily down. Please try again in a few minutes." |
| Network | `Failed to fetch` | "We couldn't reach the service. Check your internet connection." |

## 4. Setup Wizard UX Best Practices

*   **Stepper Navigation**: Visually indicate progress (e.g., "Step 1 of 4: Connectivity").
*   **Contextual Help**: Add "Where do I find this?" links next to input fields, opening modals with screenshots of the third-party dashboard.
*   **Pre-flight Checks**: Step 1 should be a system check (Write permissions, Node version, Internet connectivity) to fail fast if the environment isn't ready.
*   **State Persistence**: Save form state in `localStorage` so users don't lose progress if they accidentally refresh or navigate away to find a key.

## 5. One-Click Verification Scripts

After configuration, run a comprehensive "System Health Check" before finalizing.

*   **The "All Systems Go" Dashboard**: A final screen that runs a parallel promise array of checks:
    *   [x] Database Connection
    *   [x] OpenAI API Connection
    *   [x] Vector DB Connectivity
    *   [x] File System Write Access
*   **Implementation**:
    ```typescript
    // Example Verification Flow
    const results = await Promise.allSettled([
      checkDatabase(),
      checkLLM(),
      checkStorage()
    ]);
    const allPassed = results.every(r => r.status === 'fulfilled' && r.value.ok);
    ```

## Unresolved Questions
1.  How do we secure the `/setup` route to prevent re-initialization by malicious actors after the app is live?
2.  Should we use encryption for storing API keys in the generated config file?

## Sources
- [Next.js Middleware Documentation](https://nextjs.org/docs/app/building-your-application/routing/middleware)
- [UX Planet: Designing Better Setup Wizards](https://uxplanet.org/designing-better-setup-wizards-5e2837333152)
- [OpenAI API Error Handling](https://platform.openai.com/docs/guides/error-codes)
