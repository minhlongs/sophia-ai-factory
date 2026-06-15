# Phase 4: Post-Deploy Verification

## Objective
Verify production health via smoke tests.

## Steps
1.  **Retrieve Production URL**:
    ```bash
    export PROD_URL="https://$(vercel ls --json | jq -r '.[0].url')"
    echo "Testing against: $PROD_URL"
    ```
2.  **Run Smoke Tests**:
    ```bash
    # Run smoke tests against production
    BASE_URL=$PROD_URL npm run test:smoke
    ```
3.  **Manual HTTP Check**:
    ```bash
    curl -I $PROD_URL
    ```

## Success Criteria
- Smoke tests pass
- HTTP 200 OK on root URL
