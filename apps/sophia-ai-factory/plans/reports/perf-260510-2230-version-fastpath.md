# /api/version Fast-Path — Cache-Control Ships, `revalidate` Trap Avoided

Commits: `90f32954` (cache headers) → `fc371bb5` (regression, revalidate=60) → `241e03e2` (revert + force-dynamic guard).

## What shipped
- `Cache-Control: public, max-age=30, s-maxage=60, stale-while-revalidate=120`
  on the public response.
- Admin introspection path (Bearer `INTROSPECT_TOKEN`) stays uncached.
- 6 vitest cases covering public shape, cache header, admin payload, admin
  no-cache, wrong-token fallback.

## Latency
- Manual TTFB stays at ~0.18-0.26s consistently (was 0.20-0.26s pre-change).
- No measurable cold-start improvement because the route was already
  lightweight (one env-var read + JSON build).
- CF `cf-cache-status` header still empty — Workers responses don't auto-cache
  at CF edge without a Cache Rule. Browsers + intermediate proxies DO respect
  the directive.

## Regression caught (90 seconds in production)
- Commit `fc371bb5` added `export const revalidate = 60`, intending to leverage
  the R2 incremental cache that landed in `acb137bd`.
- **Effect**: Next.js opted the route into build-time static rendering. At
  build time, `process.env.COMMIT_SHA` is empty, so the cached response baked
  `shortSha: "unknown"` and shipped to production.
- Detected immediately by the post-deploy SHA-match assertion in the standard
  verify script (`Live: unknown`).
- Reverted in `241e03e2` and replaced `revalidate` with
  `export const dynamic = "force-dynamic"` plus an in-source warning so the
  trap doesn't reappear.

## Lessons
1. **Routes that read deploy-time env vars from the Worker runtime CANNOT use
   `revalidate` / `force-static`** — these flags trigger build-time generation
   where the runtime env doesn't exist. Stick with Cache-Control headers.
2. **CF Workers ≠ CF Cache** by default. To get real edge caching, either:
   - Add a CF Cache Rule for the URL pattern in the dashboard.
   - Or write `caches.default.put(request, response)` inside the Worker.
   - Or move the response generation off the Worker entirely (e.g. into
     `wrangler.toml` site assets or a static export).
3. **Always run the SHA-match verify step after deploys** — without it this
   regression would have lasted hours.

## Unresolved
1. CF Cache Rules for `/api/version` + `/api/health` would push warm hits
   sub-50ms. Dashboard config, not code — needs operator action.
2. `cf-cache-status` header is empty everywhere. Worth investigating whether
   a wrangler config can opt the entire Worker into CF cache.
