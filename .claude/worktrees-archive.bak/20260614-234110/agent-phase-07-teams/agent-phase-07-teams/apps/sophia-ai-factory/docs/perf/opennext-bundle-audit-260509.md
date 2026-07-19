# OpenNext Bundle Audit — 2026-05-09
**F-PC-7 | Wave 11 G2 Performance Audit**

## Audit Method

Analyzed `.open-next/server-functions/default/handler.mjs.meta.json` (esbuild meta format).
Build artifact: `.open-next/server-functions/default/handler.mjs`

## Bundle Sizes

| Artifact | Size |
|---|---|
| `handler.mjs` (total CF Worker bundle) | **31 MB** |
| `worker.js` (entry shim) | 5 KB |
| Total meta inputs | 32,851 KB |

## Top 10 Bundle Offenders

| Rank | Package / Chunk | Size | Notes |
|---|---|---|---|
| 1 | `next/dist/server/load-manifest.external.js` | 1,749 KB | Next.js server manifest — unavoidable |
| 2 | Turbopack chunked node_modules (×3 chunks) | ~1,053 KB each (×3 = ~3,159 KB total) | Mixed deps bundled by turbopack chunks |
| 3 | `better-auth` (across all chunks) | **1,334 KB** | Auth library — highest actionable dep |
| 4 | `@vercel/og` (edge OG image gen) | **717 KB** | Only used in `/api/og` route if present |
| 5 | `next-server/app-page-turbo.runtime.prod` | 591 KB | Next.js runtime — unavoidable |
| 6 | `[turbopack]_runtime.js` (×2) | 504 KB each | Turbopack runtime — unavoidable |
| 7 | `zod` (v4 classic schemas, ×3 chunks) | **741 KB total** (247 KB × 3) | Schema validation — partially tree-shakeable |
| 8 | `better-auth-session` SSR chunks (×2) | ~325–337 KB each | Auth session hydrated on every SSR page |
| 9 | `react-dom` edge server | **267 KB** | React server render — unavoidable |
| 10 | `html2canvas` | **193 KB** | Canvas screenshot lib — likely not needed server-side |

## Redis Client Overhead

`@redis/client` + `ioredis` = **921 KB** in bundle (701 KB + 220 KB).
These are server-side only but still inflate the worker bundle size.

## Actionable Recommendations

### High Impact (Quick Wins)

1. **`html2canvas` (193 KB)** — Move to client-side dynamic import only. It should never be in the server bundle.
   ```tsx
   // Use dynamic import instead:
   const html2canvas = (await import('html2canvas')).default;
   ```

2. **`@vercel/og` (717 KB)** — If `/api/og` route is unused or rarely hit, gate it behind `next/dynamic` or remove. OG image generation can be offloaded to a separate worker.

3. **`better-auth` (1,334 KB)** — Tree-shake by importing specific subpaths instead of barrel:
   ```ts
   // Instead of: import { ... } from 'better-auth'
   import { ... } from 'better-auth/client'  // client-only splits
   ```

4. **`zod` deduplication (741 KB across 3 identical chunks)** — Zod v4 classic schemas duplicated 3× in the bundle. Confirm single zod version in `package.json`. Add `resolve.dedupe: ['zod']` to `next.config.ts`.

5. **Redis on edge (`@redis/client` + `ioredis` = 921 KB)** — The app uses `@upstash/redis` for KV. If `@redis/client`/`ioredis` are pulled in as transitive deps and not used directly, mark as `serverExternalPackages` in `next.config.ts`:
   ```js
   serverExternalPackages: ['ioredis', '@redis/client']
   ```

### Medium Impact

6. **Route-based code splitting for heavy pages** — Dashboard pages importing chart/canvas libs should use `next/dynamic` with `ssr: false` to prevent server bundle inflation.

7. **`better-auth-session` hydration (325–337 KB × 2 SSR chunks)** — Auth session is instantiated in every SSR page. Evaluate lazy session resolution pattern to avoid loading full better-auth server on every request.

8. **Bundle analyzer for ongoing monitoring** — Add `@next/bundle-analyzer` to CI:
   ```json
   "scripts": {
     "analyze": "ANALYZE=true next build"
   }
   ```

## Summary

- **Total worker bundle**: 31 MB (raw). Cloudflare Workers limit is 10 MB compressed. Confirm build passes CF size check — OpenNext may chunk appropriately, but `html2canvas` and `@vercel/og` are primary cut candidates.
- **Top actionable savings**: html2canvas (−193 KB) + @vercel/og removal/dynamic (−717 KB) + ioredis externalize (−921 KB) = **~1.8 MB reduction** in server bundle.
- **Zod dedup**: Remove redundant 3× zod chunks → estimated −494 KB.

## Files to Change (follow-up, NOT part of this phase)

- `next.config.ts` — `serverExternalPackages`, `resolve.dedupe`
- Any page importing `html2canvas` directly — add `dynamic(() => import('html2canvas'))` wrapper
- `package.json` — review if `ioredis` is a direct dep or can be removed
