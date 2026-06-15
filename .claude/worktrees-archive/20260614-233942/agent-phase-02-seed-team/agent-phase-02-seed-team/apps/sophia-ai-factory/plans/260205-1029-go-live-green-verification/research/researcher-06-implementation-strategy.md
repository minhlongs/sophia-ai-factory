# Research: Implementation Strategy & Script Specifications

## 1. The "Green" Script (`scripts/verify.sh`)
**Purpose**: Single source of truth for local and CI verification.
**Specifications**:
- **Strict Mode**: `set -euo pipefail`
- **Steps**:
  1.  `lint`: `npm run lint`
  2.  `types`: `tsc --noEmit`
  3.  `test`: `npm run test -- --run` (Single run, not watch)
  4.  `build`: `npm run build`
  5.  `audit`: `npm audit --audit-level=critical` (Allow high for now, block critical)
- **Output**: clearly clearly colored logs (Green for pass, Red for fail).

## 2. Test Configuration (`vitest.config.ts`)
**Purpose**: Enforce coverage.
**Update**:
- Add `coverage` object to `test` config.
- Set `thresholds`:
  - `global`: { lines: 80, functions: 80, branches: 75, statements: 80 }
- **Reporters**: `text`, `json-summary` (for report generator).

## 3. Certification Generator (`scripts/generate-certification.js`)
**Purpose**: Create `CERTIFICATION.md`.
**Logic**:
- Read `coverage/coverage-summary.json`.
- Get Git info (`git rev-parse HEAD`, `git branch`).
- Check `npm audit` JSON output.
- Generate Markdown string.
- Write to `CERTIFICATION.md`.

## 4. GitHub Actions Workflow (`.github/workflows/verify.yml`)
**Purpose**: CI Automation.
**Triggers**: `push: [main]`, `pull_request: [main]`.
**Jobs**:
- `verify`:
  - `runs-on: ubuntu-latest`
  - `uses: actions/checkout`
  - `uses: actions/setup-node`
  - `run: npm ci`
  - `run: ./scripts/verify.sh`
  - `run: node scripts/generate-certification.js` (on success)
  - `uses: actions/upload-artifact` (save `CERTIFICATION.md`)

## 5. Pre-Deployment Hook
**Strategy**:
- Use `husky` (if available) or `pre-push` git hook to run `scripts/verify.sh` (or a lighter version) before pushing.
- **Recommendation**: Create `scripts/pre-push.sh` running `lint` and `test` (skip build for speed) and configure via git hooks.
