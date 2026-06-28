# Research: Pre-Deployment Validation Workflows (Vercel Focus)

## 1. The "Verify-Then-Promote" Pattern
Vercel allows for a distinct separation between "Preview" (Pull Requests) and "Production" (Push to Main). The validation workflow leverages this.

### Workflow Steps
1.  **Local Verification**:
    - Developer runs `npm run verify` (custom script wrapping lint, types, test).
    - Commit & Push.
2.  **Preview Environment (Automated)**:
    - Vercel builds and deploys to `sophia-ai-factory-git-feat-x.vercel.app`.
    - **GitHub Action**: Triggers E2E Smoke Tests against this Preview URL.
    - **Playwright**: Runs critical path tests against the *live* preview URL.
3.  **Quality Gate (CI)**:
    - If E2E tests fail -> Block Merge.
    - If E2E tests pass -> Allow Merge.
4.  **Production Promotion**:
    - Merge to `main`.
    - Vercel deploys to Production.
    - **Post-Deploy Check**: Immediate curl check of `/api/health`.

## 2. Vercel-Specific Checks
To ensure "Green" status specifically on Vercel:

- **Environment Variable Validation**:
  - Use a script `scripts/validate-env.js` executed during `next build`.
  - Check that all required `NEXT_PUBLIC_` and server-side keys exist.
  - Fail the build immediately if missing.

- **Edge Function Limits**:
  - Monitor bundle size of Edge Functions (1MB limit).
  - Use `next-bundle-analyzer` to track sizes.

## 3. "Green" Verification Command
A single command to run the full suite locally before pushing.

`package.json`:
```json
"scripts": {
  "verify:green": "run-s lint type-check test build audit"
}
```
*Requires `npm-run-all`.*

## 4. Automated "Go-Live" Decision Matrix

| Metric | Threshold | Action if Failed |
|--------|-----------|------------------|
| **Lint/Type** | 0 Errors | Fail Build |
| **Unit Tests** | 100% Pass | Fail Build |
| **Coverage** | >80% Global | Warn (Soft Fail) |
| **Audit** | 0 Critical | Fail Build |
| **E2E Smoke** | 100% Pass | Block Merge |
| **LCP** | < 2.5s | Warn (Soft Fail) |

## 5. Unresolved Questions
- Do we need "Canary Deployments" for this stage of the project? (Likely YAGNI for now).
- Is `npm-run-all` already installed or should we use standard `&&` chaining? (KISS: Use `&&` initially).
