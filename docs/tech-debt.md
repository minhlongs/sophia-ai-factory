# Technical Debt & Maintenance Log

> **"Be honest about the debt, or it will bankrupt you."**

## Frontend (Next.js)

### 🟡 Medium Priority
- **MD3 Compliance**:
  - **Issue**: UI components are not fully compliant with Material Design 3 (M3) strict mode.
  - **Fix**: Update Tailwind classes to use MD3 design tokens (e.g., `bg-[var(--md-sys-color-surface)]`).

## Backend (Next.js API Routes)

### 🟢 Low Priority
- **E2E Test Coverage**:
  - **Issue**: Playwright E2E tests exist in CI/CD pipeline config but not fully implemented.
  - **Fix**: Add Playwright tests for critical user flows (onboarding, subscription, campaign creation).

## Infrastructure

### 🟡 Medium Priority
- **Vercel Deployment**:
  - **Issue**: CI/CD `ci-cd.yml` pipeline is in nested `apps/sophia-ai-factory/.github/workflows/` — GitHub Actions only reads from repo root `.github/workflows/`.
  - **Fix**: Move Vercel deployment workflow to root `.github/workflows/` or set up Vercel Git integration directly.

### 🟢 Low Priority
- **Secrets Management**:
  - **Issue**: Currently relying on `.env` files and GitHub Secrets.
  - **Improvement**: Consider using Vercel environment variables UI for production secrets.
