# Research: CI/CD Verification & Production Certification

## 1. Test Coverage Requirements
To certify production readiness, the following coverage thresholds must be enforced via Vitest configuration (`vitest.config.ts`):

- **Global Thresholds**:
  - Statements: >80%
  - Branches: >75%
  - Functions: >80%
  - Lines: >80%
- **Critical Paths** (must have 100% coverage):
  - `src/lib/validation/`: API key and input validation logic.
  - `src/app/api/webhooks/`: Payment processing and event handling.
  - `src/app/actions/`: Server actions handling sensitive user operations.

**Configuration**:
```typescript
// vitest.config.ts
test: {
  coverage: {
    reporter: ['text', 'json-summary', 'html'],
    thresholds: { lines: 80, functions: 80, branches: 75, statements: 80 }
  }
}
```

## 2. CI/CD Pipeline & Exit Code Validation
Since `.github/workflows` is currently missing, a standard `verify.yml` workflow is required to enforce quality gates before merging to `main`.

**Pipeline Steps (Exit Code 0 Required):**
1.  **Linting**: `npm run lint` (ESLint) - Ensures code quality and standard adherence.
2.  **Type Checking**: `tsc --noEmit` - Validates TypeScript types (crucial for Next.js app router).
3.  **Testing**: `npm run test` - Runs Vitest suite.
4.  **Build Verification**: `npm run build` - Ensures the application builds successfully (catches React Compiler errors).

**Failure Strategy**: Any non-zero exit code blocks deployment.

## 3. Exit Code Verification Best Practices
Automated pipelines must rely on strict exit codes to prevent "false positives."

- **Standard**: `0` = Success, Non-zero (`1+`) = Failure.
- **Bash Strict Mode**: Scripts should start with `set -euo pipefail` to fail strictly on any command error.
- **CI/CD Pipeline Rule**:
  - **NEVER** use `;` to chain commands (e.g., `build ; deploy`).
  - **ALWAYS** use `&&` (e.g., `build && deploy`).
  - **Verification**: `echo $?` after critical steps to log exit status.

**Example Strict Verification Script (`scripts/verify-gate.sh`):**
```bash
#!/bin/bash
set -euo pipefail

echo "🔍 Starting Quality Gate Verification..."

echo "1️⃣  Linting..."
npm run lint

echo "2️⃣  Type Checking..."
npm run type-check

echo "3️⃣  Unit Tests..."
npm run test:ci

echo "4️⃣  Build Check..."
npm run build

echo "✅ ALL GATES PASSED - Ready for Certification"
```

## 4. Rollback Criteria & Safety Gates
- **Vercel Instant Rollback**: Primary mechanism.
- **Safety Gate**:
  - Implement a **Synthetic Transaction** (e.g., generate a 1-second preview video) immediately after deployment.
  - If Synthetic Transaction fails (returns 5xx or timeout), automatically trigger Vercel rollback via Vercel CLI or API.
