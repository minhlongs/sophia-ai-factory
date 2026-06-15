# Phase 1: Pre-Flight Verification

## Objective
Verify all local quality gates passed before pushing.

## Steps
1.  **Clean Install**: Ensure dependencies are clean.
    ```bash
    rm -rf node_modules .next
    npm install
    ```
2.  **Run Verification Script**: Executes lint, type-check, tests, and build.
    ```bash
    npm run verify:green
    ```
    *Note: This runs `./scripts/verify.sh`*
3.  **Verify Test Coverage**: Ensure strict test passing.
    ```bash
    npm run test
    ```
4.  **Dry Run Build**: Confirm production build succeeds locally.
    ```bash
    npm run build
    ```

## Success Criteria
- `verify:green` exits with 0
- Build folder `.next` created
- No linting or type errors
