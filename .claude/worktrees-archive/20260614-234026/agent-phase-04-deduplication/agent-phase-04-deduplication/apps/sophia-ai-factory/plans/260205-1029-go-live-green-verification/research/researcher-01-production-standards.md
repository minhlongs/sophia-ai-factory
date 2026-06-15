# Production Readiness Certification Standards & Best Practices

## Executive Summary
This report outlines the rigorous standards required for certifying a web application as "Production Ready" (Green Verification). It focuses on Next.js/Vercel architectures and establishes strict quality gates for Go-Live certification.

## 1. Production Deployment Checklist (Next.js / Vercel)
**Critical Pre-Flight Checks:**
- **Environment Variables**: Verify all secrets in Vercel (Production environment) match strict security requirements. Ensure `NEXT_PUBLIC_` is only used for non-sensitive data.
- **Build Optimization**:
  - Ensure `next.config.js` enables appropriate optimizations (swcMinify, image optimization).
  - Verify `reactCompiler: true` (experimental) usage is stable if enabled.
- **Caching & ISR**: Validate revalidation strategies. Ensure `Cache-Control` headers are correctly set for static assets.
- **Error Handling**: Custom `404` and `500` pages must be present and unbranded.
- **Security Headers**: Content Security Policy (CSP), X-Content-Type-Options, X-Frame-Options configured in `next.config.js` or middleware.
- **Analytics & Logging**: Vercel Analytics/Speed Insights enabled; remote error logging (e.g., Sentry) connected.

## 2. Quality Gate Standards (The "Green" State)
A "Green" state means passing **ALL** of the following gates without bypass.

| Gate | Command / Standard | Success Criteria |
|------|-------------------|------------------|
| **Linting** | `npm run lint` | 0 errors, 0 warnings (strict). Follows `eslint-config-next`. |
| **Type Safety** | `tsc --noEmit` | 0 TypeScript errors. `strict: true` in `tsconfig.json`. |
| **Build** | `npm run build` | Successful compilation. Bundle size within budgets (First Load JS < 120kB). |
| **Testing** | `npm run test` (or `vitest`) | 100% pass rate. No skipped tests. >80% coverage recommended. |
| **E2E Smoke** | Playwright/Cypress | Critical user paths (Login, Signup, Payment) verified. |
| **Audit** | `npm audit` | 0 Critical/High vulnerabilities. |

## 3. Exit Code Verification Best Practices
Automated pipelines must rely on strict exit codes to prevent "false positives."

- **Standard**: `0` = Success, Non-zero (`1+`) = Failure.
- **Bash Strict Mode**: Scripts should start with `set -euo pipefail` to fail strictly on any command error.
- **CI/CD Pipeline Rule**:
  - **NEVER** use `;` to chain commands (e.g., `build ; deploy`).
  - **ALWAYS** use `&&` (e.g., `build && deploy`).
  - **Verification**: `echo $?` after critical steps to log exit status.

## 4. Pre-Deployment Validation Workflows
**The "Verify-Then-Promote" Pattern:**

1.  **Local Verification**: Developer runs `tsc && npm run lint && npm run build` locally.
2.  **Preview Environment**:
    - Auto-deploy to Vercel Preview URL.
    - Automated "Smoke Test" against Preview URL.
3.  **Staging (Optional)**: Mirror of production data (sanitized) for final UAT.
4.  **Production Promotion**:
    - Deploy to Production.
    - **Post-Deploy Health Check**: Automated script pings `/api/health` or critical endpoints immediately after promotion.
    - **Rollback Plan**: Instant rollback strategy verified via Vercel dashboard.

## 5. Certification Report Format (GO-LIVE Documentation)
The final "Go-Live" artifact must be a generated markdown report.

**Template Structure:**
```markdown
# 🟢 GO-LIVE CERTIFICATION REPORT
**Date:** YYYY-MM-DD | **Commit:** [Hash] | **Environment:** Production

## 1. Quality Gates
- [x] Linting Passed (Report: link)
- [x] Type Check Passed
- [x] Build Successful (Duration: Xm Ys)
- [x] Unit Tests: X/X Passed

## 2. Security & Performance
- [x] `npm audit` Clean
- [x] Lighthouse Score: >90 (Performance/SEO/Accessibility)

## 3. Verification
- [x] Post-Deploy Smoke Test: SUCCESS
- [x] Critical API Endpoints: 200 OK

**Status:** ✅ APPROVED FOR RELEASE
**Sign-off:** [Automated Agent / Lead Dev]
```

## Unresolved Questions
- Is there a specific specialized security audit tool required beyond `npm audit`?
- Are there specific budget thresholds for bundle sizes defined for this project?

## References
- [Next.js Production Checklist](https://nextjs.org/docs/app/building-your-application/deploying/production-checklist)
- [Vercel Deployment Best Practices](https://vercel.com/docs/deployments/best-practices)
- [OWASP Secure Headers Project](https://owasp.org/www-project-secure-headers/)
