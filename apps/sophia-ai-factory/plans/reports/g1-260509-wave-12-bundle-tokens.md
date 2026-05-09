# Phase 2 Wave 12 Group G1 — Bundle + Token Refresh Wiring

**Date:** 2026-05-09
**Status:** COMPLETED

## Files Modified

| File | Lines Changed | Action |
|---|---|---|
| `next.config.ts` | +12 | Bundle optimizations |
| `src/lib/publishing/oauth-token-refresher.ts` | +72 | 4 new provider refresh cases + imports |
| `src/lib/publishing/__tests__/oauth-token-refresher.test.ts` | +58 | 6 new tests for 4 providers |
| `src/seed/auth/reset-password-token.ts` | 0 | Kept — callers exist in tests |
| `plans/reports/g1-260509-wave-12-bundle-tokens.md` | new | This report |

---

## Task 1: Bundle Optimizations (next.config.ts)

**Changes applied:**
- `serverExternalPackages`: added `@redis/client` alongside existing `redis`, `ioredis` → moves all 3 redis clients to runtime, saves ~921 KB
- `experimental.optimizePackageImports: ['better-auth', 'date-fns', 'lucide-react']` → tree-shake heavy deps, est. ~500 KB reduction on `better-auth` barrel
- `webpack()` callback: `config.resolve.dedupe.push('zod')` → collapses 3 duplicate zod chunks → est. −494 KB
- `@vercel/og`: grep found 0 usages in `src/` — no wrapping needed

**Expected total reduction from audit recommendations:**
- Redis externalize: −921 KB
- Zod dedup: −494 KB
- better-auth tree-shake: est. −200–400 KB (package-import optimization)
- Total est.: ~1.4–1.8 MB off server bundle

---

## Task 2: Token Refresh Wiring (4 new publishers)

**Existing file:** `src/lib/publishing/oauth-token-refresher.ts` (at `lib/publishing/`, not `seed/auth/`)

New imports + switch cases added:

| Provider | Mechanism | Notes |
|---|---|---|
| `threads` | `refreshLongLivedToken(currentToken)` via `th_refresh_token` grant (graph.threads.net) | Uses decrypted access_token directly; no separate refresh_token |
| `reddit` | `refreshAccessToken(refreshToken)` via Basic Auth + `grant_type=refresh_token` | reddit-oauth-client.ts already had this function |
| `bluesky` | `refreshAtprotoSession(refreshJwt)` via `com.atproto.server.refreshSession` | refreshJwt stored as `refresh_token`; both access+refresh JWT rotate |
| `mastodon` | `/oauth/token` `grant_type=refresh_token` per-instance; perpetual fallback if no `refresh_token` | Instance URL parsed from `external_account_id` via `parseExternalAccountId` |

All paths use `encryptToken`/`decryptToken` roundtrip via `token-crypto.ts`. Rotated tokens saved back to DB.

---

## Task 3: verifyResetToken

**Decision: KEPT (not deleted)**

`src/seed/auth/__tests__/reset-password-token.test.ts` imports `verifyResetToken` with 4 test cases (line 8, 153, 167, 180, 190). Since callers exist, the function was not deleted per task instructions.

---

## Tests Status

- `src/lib/publishing/__tests__/oauth-token-refresher.test.ts`: **11/11 pass** (4 existing + 6 new + 1 refreshExpiringTokens)
- `src/seed/auth` suite: **135/135 pass**
- TypeScript (`npx tsc --noEmit`): **0 new errors** from G1 changes
  - 1 pre-existing error in `video-generate.ts` (present before Wave 12, not owned by G1)
  - `settings/import/route.ts` error from parallel wave group (not G1 ownership)

---

## Unresolved Questions

- `@vercel/og` (717 KB) is a declared dep but has 0 src/ usages — safe to remove from `package.json` entirely in a future wave
- `html2canvas` (193 KB audit finding) — no dynamic import wrapping done (not in G1 scope); requires identifying which page imports it
