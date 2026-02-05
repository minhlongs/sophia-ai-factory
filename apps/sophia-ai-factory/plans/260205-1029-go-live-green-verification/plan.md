# Implementation Plan - Go-Live Green Verification

## Context
- **Goal**: Establish rigorous "Production Ready" certification standards and automated verification pipelines.
- **Reports**: `./research/` contains standards, templates, and gap analysis.
- **Target**: A strict "Green" state for all code merging to main.

## Phase 1: Foundation - The Verification Script
**Goal**: Create a reliable, strict verification script that serves as the single source of truth.

- [ ] **Step 1.1**: Update `vitest.config.ts`
  - Add coverage thresholds (80% global).
  - Configure reporters (text, json-summary).
- [ ] **Step 1.2**: Implement `scripts/verify.sh`
  - Use `set -euo pipefail`.
  - Chain: Lint -> Types -> Test -> Audit -> Build.
  - Ensure clear logging and strict exit codes.
- [ ] **Step 1.3**: Update `package.json`
  - Add `npm-run-all` (optional) or ensure scripts rely on `scripts/verify.sh`.
  - Define `verify:ci` vs `verify:local`.

## Phase 2: CI/CD Automation
**Goal**: Enforce the verification script in GitHub Actions.

- [ ] **Step 2.1**: Create `.github/workflows/verify.yml`
  - Trigger on Pull Requests and Push to Main.
  - Run `scripts/verify.sh`.
  - Cache node modules and Next.js build artifacts.

## Phase 3: Certification & Reporting
**Goal**: Generate artifacts proving production readiness.

- [ ] **Step 3.1**: Create `scripts/generate-certification.js`
  - Parse coverage summaries and test results.
  - Generate `CERTIFICATION.md` template.
- [ ] **Step 3.2**: Integrate into CI pipeline
  - Run generator after successful verification.
  - Upload as workflow artifact.

## Phase 4: Pre-Deployment Safety
**Goal**: Verify deployment health.

- [ ] **Step 4.1**: Refine `scripts/health-check.js`
  - Ensure it can accept a target URL (for post-deploy checks).
  - Verify critical integrations (OpenRouter, etc.) via mock/dry-run if possible.

## Success Criteria
- [ ] `scripts/verify.sh` passes locally with exit code 0.
- [ ] GitHub Action runs successfully on PR.
- [ ] `CERTIFICATION.md` is generated with valid coverage data.
- [ ] Coverage enforcement prevents code with <80% coverage from passing.
