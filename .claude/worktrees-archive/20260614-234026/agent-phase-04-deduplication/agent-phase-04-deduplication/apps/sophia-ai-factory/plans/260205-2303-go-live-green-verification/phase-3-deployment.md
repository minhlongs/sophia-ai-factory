# Phase 3: Production Deployment

## Objective
Deploy to production via GitOps (Push to Main).

## Steps
1.  **Push to Remote**:
    ```bash
    git push -u origin main
    ```
2.  **Monitor GitHub Actions** (if applicable):
    ```bash
    # Watch for actions pipeline
    gh run watch
    ```
3.  **Monitor Vercel Deployment**:
    *Verify Vercel picks up the push to main.*
    ```bash
    # List deployments and get the latest URL
    vercel ls --json | jq -r '.[0].url'
    ```
4.  **Verify Deployment State**:
    ```bash
    DEPLOY_URL=$(vercel ls --json | jq -r '.[0].url')
    vercel inspect $DEPLOY_URL
    ```

## Success Criteria
- Git push successful
- Vercel deployment status is `READY`
- Valid Deployment URL retrieved
