# OpenNext Build Fix Report
**Date:** 2026-04-29
**Commit:** ed13e406

## Root Cause

Next.js 16.2.3 standalone output omits `instrumentation.js` (and `.js.map`) while copying `instrumentation.js.nft.json`. OpenNext's `copyTracedFiles.js` (line 142) checks `existsSync(standaloneNextDir + "/server/instrumentation.js")` after copying the nft.json — file absent → throws.

**Confirmed:** `instrumentation.js` present in `.next/server/` but absent in `.next/standalone/.next/server/`.

## Fix Applied (Fix A+D hybrid)

Upgraded `@opennextjs/cloudflare` 1.17.3 → 1.19.4 (Fix A — insufficient alone).

Split deploy into 3-step sequence:
1. `next build` (produces `.next/`)
2. `node scripts/fix-instrumentation-standalone.mjs` — copies `instrumentation.js` + `.js.map` from `.next/server/` to `.next/standalone/.next/server/`
3. `npx @opennextjs/cloudflare build --skipNextBuild` — uses patched standalone output

Sentry, instrumentation.ts content unchanged (Fixes B/C/D/E not needed).

## Verification

- `npx @opennextjs/cloudflare build --skipNextBuild` → **"OpenNext build complete."**
- `.open-next/worker.js` exists (2278 bytes)
- `tsc --noEmit` → **0 errors**
- `npm test` → **1696 passed, 31 skipped**
- Commit: `ed13e406` pushed to `origin/main`

## Changed Files

- `apps/sophia-ai-factory/package.json` — updated `deploy` and `deploy:build` scripts
- `apps/sophia-ai-factory/package-lock.json` — upgraded @opennextjs/cloudflare to 1.19.4
- `apps/sophia-ai-factory/scripts/fix-instrumentation-standalone.mjs` — NEW: standalone patcher
