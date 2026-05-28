# Deployment Log

This log documents the execution details of the deployment pipeline for Sophia AI Factory on Cloudflare Workers.

## Deployment Details

- **Trigger:** Automated deploy tool run (`npm run deploy:full`)
- **Target Branch:** `main`
- **Timestamp:** 2026-05-28T14:22:18Z
- **Commit SHA:** `49e3c4686940a022ea1295b95ea237a858ea28d0`
- **Commit Message:** `fix(T001): apply secrets injection after deploy to resolve Cloudflare Worker versioning conflict`

## Pipeline Steps Executed

1. **Pre-flight Checks:**
   - Completed type check (`tsc --noEmit`) and unit tests (Passed 4856 / 4856 tests).
   - Validated translation keys (`npm run i18n:validate`).
2. **RAM & OOM Optimization:**
   - Configured `SKIP_SENTRY_BUILD=1` and `SKIP_RC=1` to optimize Next.js build and prevent M1 Mac OOM crashes.
3. **Build & Optimizations:**
   - Built Next.js production app.
   - Ran updated `strip-ssr-bloat.sh` to strip Sentry SDK and optimise immer from server-side chunks, successfully reducing the compressed bundle size from 10.23 MB to 8.78 MB.
   - Built OpenNext Cloudflare adapter (`.open-next/worker.js`).
4. **Deploy Execution:**
   - Ran `npx opennextjs-cloudflare deploy` and uploaded all 269 assets and worker script.
   - Set Cloudflare Worker secrets (`COMMIT_SHA`, `DEPLOYED_AT`, `DEPLOY_BRANCH`) successfully post-deploy to avoid versioning conflicts.
