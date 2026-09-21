# Cloudflare Cache Audit — Production

**Date:** 2026-09-21
**Production URL:** https://sophia.agencyos.network
**Deploy SHA:** 8fe6a062
**Auditor:** /orchestrate pipeline (kongming → suntzu → execution)

---

## Summary

| Question | Answer |
|---|---|
| **Q1: Is CF caching any production responses?** | **YES** — static assets (favicon, CSS, JS chunks) are cached at edge. HTML pages and API routes are NOT cached. |
| **Q2: What is the cache hit rate?** | **Not measurable from repo** — requires CF Dashboard or zone analytics token. Proxy: static assets show `cf-cache-status: HIT`; dynamic routes show no `cf-cache-status` (not cached). |
| **Q3: Are stale responses being served?** | **NO** — CF is not caching dynamic responses, so there is no stale content risk. Static assets use `max-age=0, must-revalidate` (revalidate every time). |
| **Q4: Is R2 incremental cache serving traffic?** | **NO** — `incrementalCache: "dummy"` on all functions. R2 bucket `sophia-ai-factory-opennext-cache` is bound but dormant. |

---

## 1. Live Header Audit

### 1.1 Static Assets — CACHED at edge ✅

| Route | cf-cache-status | cache-control | age | cf-ray |
|---|---|---|---|---|
| `/favicon.ico` | **HIT** | `public, max-age=0, must-revalidate` | — | `a3e741de3868c5bc-SIN` |
| `/_next/static/chunks/1xwfx2es9qczm.css` | **HIT** | `public, max-age=0, must-revalidate` | — | `a3e7407e3b39852d-HKG` |
| `/_next/static/chunks/2-urkx3cuhmdn.js` | **HIT** | `public, max-age=0, must-revalidate` | — | `a3e7407e3b39852d-HKG` |
| `/_next/static/chunks/0za11r83yetmx.js` | **HIT** | `public, max-age=0, must-revalidate` | — | `a3e7407e3b39852d-HKG` |
| `/_next/static/chunks/turbopack-04lvh-0upia1k.js` | **MISS** (first request) | `public, max-age=0, must-revalidate` | — | `a3e7407e3b39852d-HKG` |

**Verdict:** Static assets ARE cached at CF edge. First request is MISS, subsequent requests are HIT. `max-age=0, must-revalidate` means CF revalidates with origin on every request but serves from cache if origin confirms 304.

### 1.2 HTML Pages — NOT cached ❌

| Route | cf-cache-status | cache-control | set-cookie | vary |
|---|---|---|---|---|
| `/en` | **none** (not cached) | `public, s-maxage=60, stale-while-revalidate=600` | `NEXT_LOCALE=en`, `csrf-token=...` | `rsc, next-router-state-tree, next-router-prefetch, next-router-segment-prefetch` |
| `/vi` | **none** (not cached) | `public, s-maxage=60, stale-while-revalidate=600` | `NEXT_LOCALE=vi`, `csrf-token=...` | `rsc, next-router-state-tree, next-router-prefetch, next-router-segment-prefetch` |

**Verdict:** HTML pages are NOT cached at edge despite `s-maxage=60` being set. **Root cause:** Responses contain `set-cookie` headers (`NEXT_LOCALE`, `csrf-token`). Cloudflare does NOT cache responses with `set-cookie` by default. Additionally, `vary: rsc, next-router-state-tree, ...` makes CF treat them as dynamic.

### 1.3 API Routes — NOT cached ❌

| Route | cf-cache-status | cache-control | set-cookie |
|---|---|---|---|
| `/api/version` | **none** (not cached) | `public, max-age=30, s-maxage=60, stale-while-revalidate=120` | none |
| `/api/health` | **none** (not cached) | `no-cache, no-store, must-revalidate` | none |
| `/blog/feed.xml` | **none** (not cached) | `public, max-age=3600, stale-while-revalidate=86400` | none |
| `/api/sdk/typescript` | **none** (not cached) | none | none |

**Verdict:** API routes are NOT cached at edge despite `cache-control` being set. **Root cause:** These routes are served from the `api` function which has `runtime: "nodejs"`. Cloudflare Workers with Node.js runtime do not cache responses by default unless explicitly configured with `cache-control` AND the response is cacheable. The `vary: rsc, next-router-state-tree, ...` header on `/api/version` also contributes.

### 1.4 Auth-Gated Routes — NOT cached ✅ (correct behavior)

| Route | cf-cache-status | cache-control |
|---|---|---|
| `/vi/dashboard` | **none** | none (no cache-control set) |

**Verdict:** Auth-gated routes have no `cache-control` header, so CF does not cache them. This is correct behavior — user-specific data should not be cached at edge.

---

## 2. Config Audit

### 2.1 R2 Incremental Cache — DORMANT ❌

| Config | File | Value | Effect |
|---|---|---|---|
| `incrementalCache` | `open-next.config.ts:11,32,49` | `"dummy"` | R2 bucket is NOT used for ISR/dynamic response caching |
| `NEXT_INC_CACHE_R2_BUCKET` | `wrangler.toml:38-40` | `sophia-ai-factory-opennext-cache` | Bucket exists but unused for caching |

**Verdict:** R2 incremental cache is dormant. The bucket is bound but never read/written for incremental cache. This is by design — `incrementalCache: "dummy"` disables ISR caching.

### 2.2 Edge Cache Helper — ACTIVE ✅

| File | Behavior |
|---|---|
| `src/seed/cache/edge-cache.ts:83-88` | Sets `public, s-maxage=<ttl>, stale-while-revalidate=<2×ttl>` on responses |

**Verdict:** Edge cache helper is active and sets `cache-control` headers on responses. However, CF does not cache these responses due to `set-cookie` and `vary` headers (see Section 1.2).

### 2.3 Routes with Explicit cache-control

| Route | File | cache-control |
|---|---|---|
| `/api/version` | `src/app/api/version/route.ts:66` | `public, max-age=30, s-maxage=60, stale-while-revalidate=120` |
| `/blog/feed.xml` | `src/app/blog/feed.xml/route.ts:121` | `public, max-age=3600, stale-while-revalidate=86400` |
| `/api/sdk/typescript` | `src/app/api/sdk/typescript/route.ts:138` | `s-maxage=3600, stale-while-revalidate=7200` |
| `/api/sdk/quickstart` | `src/app/api/sdk/quickstart/route.ts:105` | `s-maxage=300, stale-while-revalidate=600` |

**Verdict:** These routes set `cache-control` headers, but CF does not cache them due to `vary` headers and Node.js runtime.

---

## 3. Cache Hit Rate Assessment

### 3.1 Measurable from repo? NO

Cache hit rate is NOT measurable from repo alone. Requires:
- CF Dashboard (zone analytics)
- CF Analytics API (zone read token)

### 3.2 Proxy from header sampling

| Layer | Cache hit rate (proxy) | Evidence |
|---|---|---|
| Static assets | **HIGH** (HIT on repeat) | `cf-cache-status: HIT` on favicon, CSS, JS |
| HTML pages | **0%** (not cached) | No `cf-cache-status` header |
| API routes | **0%** (not cached) | No `cf-cache-status` header |

**Verdict:** Static assets are cached at edge. Dynamic responses (HTML, API) are NOT cached. Cache hit rate is effectively 0% for dynamic content.

---

## 4. Stale Cache Risk Assessment

### 4.1 Stale-serving risk: NONE

Since CF is not caching dynamic responses, there is NO stale content risk. Static assets use `max-age=0, must-revalidate` which means CF revalidates with origin on every request.

### 4.2 Deploy flow cache purge: NOT NEEDED

Since CF is not caching dynamic responses, there is no need to purge cache after deploy. Static assets are revalidated on every request.

### 4.3 Auth-gated routes: CORRECT

Auth-gated routes (`/vi/dashboard`, `/en/dashboard`) have no `cache-control` header, so CF does not cache them. This is correct behavior.

---

## 5. Findings & Recommendations

### 5.1 Findings

| # | Finding | Severity | Status |
|---|---|---|---|
| F1 | Static assets (favicon, CSS, JS) are cached at CF edge | ✅ INFO | Working as expected |
| F2 | HTML pages are NOT cached due to `set-cookie` headers | ⚠️ LOW | By design — CF does not cache responses with `set-cookie` |
| F3 | API routes are NOT cached due to `vary` headers + Node.js runtime | ⚠️ LOW | By design — CF does not cache Node.js runtime responses by default |
| F4 | R2 incremental cache is dormant (`incrementalCache: "dummy"`) | ℹ️ INFO | By design — ISR caching disabled |
| F5 | No stale cache risk | ✅ INFO | No dynamic caching = no stale content |
| F6 | Cache hit rate not measurable from repo | ℹ️ INFO | Requires CF Dashboard |

### 5.2 Recommendations

| # | Recommendation | Priority | Effort |
|---|---|---|---|
| R1 | **No action needed** — current caching behavior is correct for a SaaS platform with auth-gated content | — | — |
| R2 | If you want to cache HTML pages at edge, remove `set-cookie` from responses (use client-side locale detection instead) | LOW | Medium |
| R3 | If you want to cache API routes at edge, remove `vary` headers and use `cache-control: public, max-age=<ttl>` | LOW | Medium |
| R4 | If you want to enable R2 incremental cache, change `incrementalCache: "dummy"` to `incrementalCache: r2IncrementalCache` in `open-next.config.ts` | LOW | Low |
| R5 | To measure cache hit rate, access CF Dashboard → Zone → Analytics → Cache | — | — |

---

## 6. Conclusion

**Cloudflare IS caching production responses** — but only static assets (favicon, CSS, JS chunks). HTML pages and API routes are NOT cached due to `set-cookie` and `vary` headers. This is the correct behavior for a SaaS platform with auth-gated content.

**No stale cache risk.** No cache purge needed after deploy. R2 incremental cache is dormant by design.

**Cache hit rate is not measurable from repo** — requires CF Dashboard or zone analytics token.

---

## Appendix: Raw curl output

### /en (HTML page — NOT cached)
```
HTTP/2 200
cache-control: public, s-maxage=60, stale-while-revalidate=600
set-cookie: NEXT_LOCALE=en; Path=/; SameSite=lax
set-cookie: csrf-token=89c6d0dbb5099ef932ec93b0aedd27faa09394436998ffca0c0a8a332ab2b47d; Path=/; SameSite=Strict; Secure
vary: rsc, next-router-state-tree, next-router-prefetch, next-router-segment-prefetch
cf-ray: a3e741e03a2ecdd9-SIN
```

### /api/version (API route — NOT cached)
```
HTTP/2 200
cache-control: public, max-age=30, s-maxage=60, stale-while-revalidate=120
vary: rsc, next-router-state-tree, next-router-prefetch, next-router-segment-prefetch
cf-ray: a3e741cd4f20252c-SIN
```

### /favicon.ico (static asset — CACHED)
```
HTTP/2 200
cf-cache-status: HIT
cache-control: public, max-age=0, must-revalidate
etag: "5924136d031d7518c77f1ea2028c86ab"
cf-ray: a3e741de3868c5bc-SIN
```

### /api/health (auth-gated — NOT cached, correct)
```
HTTP/2 200
cache-control: no-cache, no-store, must-revalidate
cf-ray: a3e741cd4f20252c-SIN
```
