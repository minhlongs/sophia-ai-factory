# Fix: Next.js node-polyfill-crypto SSR Crash → HTTP 500

## Status: Pending → In Progress

## Problem
Next.js v16's `node-polyfill-crypto.js` bundled into every SSR render calls `require('node:crypto').webcrypto` which crashes in Cloudflare Workers runtime. This is the root cause of the production HTTP 500 on all endpoints.

## Phases

### ✅ Phase 0: Analysis (complete)
- Identified root cause in `.open-next/server-functions/default/node_modules/next/dist/server/node-polyfill-crypto.js`
- Created stub: `scripts/stubs/node-polyfill-crypto-stub.js`
- Confirmed: Workers provides `globalThis.crypto` natively — no polyfill needed

### 🔄 Phase 1: Fix (current)
1. `next.config.ts` — webpack alias + serverExternalPackages
2. `scripts/strip-ssr-bloat.sh` — safety-net strip rule

### Phase 2: Verify
1. Build → 0 TS errors
2. Deploy → SHA match
3. Smoke test → HTTP 200

## Acceptance Criteria
- `npm run deploy:full` → exit 0
- `https://sophia.agencyos.network` → HTTP 200
- `/api/version` returns JSON with matching shortSha
- `/api/cron/*` endpoints respond (not 403 from auth but NOT 500 from crash)

## Touchpoints
- `next.config.ts` — webpack.resolve.alias + serverExternalPackages
- `scripts/strip-ssr-bloat.sh` — strip_mode for node-polyfill-crypto files
- `scripts/stubs/node-polyfill-crypto-stub.js` — already created, no changes needed
