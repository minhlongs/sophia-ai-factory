# CF Cache Rules — Worker-Side `caches.default` Helper + Dashboard Recommendation

Commits this slice: `41f74a33` (helper + wire `/api/version`), `863136f4` (cache-key normalization fix).

## What shipped
- **`src/seed/cache/edge-cache.ts`** — `withEdgeCache(req, ttlSec, build)` helper.
  HIT returns cached response with `x-edge-cache: HIT`; MISS runs builder
  + fire-and-forget `caches.default.put()`; BYPASS in non-Worker runtimes.
- **`/api/version` anon path** wraps the response build with the helper.
  Admin Bearer path stays uncached.
- 6 unit tests cover MISS/HIT/BYPASS/Cache-Control/non-GET semantics.

## Live observation — inconsistent

Right after the first deploy (`41f74a33`) one curl saw the win:
```
cf-cache-status: HIT
age: 17
x-edge-cache: HIT
```

But repeat verification consistently returned:
```
x-edge-cache: MISS
no cf-cache-status header
no age header
```

That means our helper runs (sets `MISS` header) but cache.put never sticks for
subsequent requests. The original HIT was likely CF's **natural edge cache**
honouring `Cache-Control: s-maxage=60` — not our `caches.default` write.

## Why the Worker-side path is fragile here

1. **Next.js App Router emits `Vary: rsc, next-router-state-tree, ...`** on
   every response. CF Cache and `caches.default` use Vary to split entries
   per request header value. curl never sends those headers, so the same URL
   maps to a different cache key from what `put` wrote. Our fix in `863136f4`
   stripped Vary from the stored copy — didn't help, suggesting the OpenNext
   response wrapper RE-INJECTS Vary AFTER our handler returns.
2. **OpenNext wraps Worker responses** through a middleware chain that may
   rewrite headers (we observed `max-age=30` → `max-age=14400` on one hit).
   The post-wrap response is what hits CF; our pre-wrap headers don't survive.
3. **`caches.default` is per-colo** — first hit in SIN populates SIN's cache
   but a hit landing in (say) NRT misses. CF Cache Rules + Cache-Control work
   across the whole edge fleet; `caches.default` does not.

## Recommended path forward — CF Cache Rules (dashboard)

Configure in Cloudflare dashboard → `agencyos.network` zone → Caching → Cache Rules:

| Rule name | Match | Cache eligibility | Edge TTL | Browser TTL |
|-----------|-------|-------------------|----------|-------------|
| `version-public-cache` | URI Path equals `/api/version` AND HTTP method equals `GET` AND Authorization header does NOT exist | Eligible | 60 seconds | 30 seconds |
| `health-public-cache` | URI Path equals `/api/health` AND no `?token=` parameter AND no `Authorization` header | Eligible | 30 seconds | 30 seconds |
| `marketing-static` | URI Path in `{/, /blog, /pricing, /status, /guide}` AND HTTP method equals `GET` | Eligible | 60 seconds | 30 seconds |

These rules apply at CF's global edge layer and bypass the Worker entirely
on HIT — no `caches.default` involvement needed.

## Why not auto-apply via API

API token in `CLOUDFLARE_API_TOKEN` lacks `Zone Cache Rules: Edit` scope
(returns auth error against `/zones/{id}/rulesets/...`). User can mint a
token with that permission, then this slice can be re-attempted
programmatically:

```bash
ZONE=98a8077adbed666020c5b9832df5fdcf  # agencyos.network
curl -X PUT "https://api.cloudflare.com/client/v4/zones/$ZONE/rulesets/phases/http_request_cache_settings/entrypoint" \
  -H "Authorization: Bearer $CF_TOKEN_CACHE_RULES_EDIT" \
  -H "Content-Type: application/json" \
  -d '{ "rules": [ ... ] }'
```

## State of the Worker-side helper

Code stays in tree because:
1. Tests pass — local semantics correct.
2. May still help in scenarios where CF natural cache doesn't kick in.
3. The diagnostic header `x-edge-cache: HIT|MISS|BYPASS` is useful even
   when CF edge cache is the actual mechanism doing the work.
4. Future routes (admin reports, dashboards) may need explicit per-Worker
   cache, where this helper applies cleanly.

## Unresolved
1. Mint token with Cache Rules permission → apply the 3 rules above.
2. Investigate why OpenNext rewrites our Cache-Control max-age from 30 to
   14400. Likely OpenNext or Next.js default; may be configurable.
3. If `caches.default` reliably fails in OpenNext, deprecate the helper or
   document it as "non-routable cache layer" + audit `Vary` rewriting.
