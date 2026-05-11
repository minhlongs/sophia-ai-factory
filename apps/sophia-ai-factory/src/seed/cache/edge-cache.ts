/**
 * Edge cache helper — opt-in `caches.default` wrapping for hot anon endpoints.
 *
 * Why: CF Workers responses don't auto-enter the CF Cache layer just because
 * we set `Cache-Control` headers. Either a dashboard Cache Rule or
 * `caches.default.put()` is required. This helper is the programmatic path
 * so the cache contract lives in the codebase rather than in dashboard state.
 *
 * Usage:
 *   ```ts
 *   import { withEdgeCache } from "@/seed/cache/edge-cache";
 *
 *   export async function GET(req: NextRequest) {
 *     return withEdgeCache(req, 60, async () => {
 *       // build the public response
 *       return NextResponse.json({ ... });
 *     });
 *   }
 *   ```
 *
 * Constraints:
 * - Caller MUST guarantee the response is safe to share across users (anon
 *   payload only — never cache personalized content).
 * - `request.method` must be GET; cache.put refuses other verbs.
 * - The cache key is the full URL including search params.
 * - Returns the freshly built response when CF cache is unavailable (local
 *   dev / Vitest / non-Worker runtimes).
 *
 * @module seed/cache/edge-cache
 */

interface CfCacheLike {
  match(request: Request): Promise<Response | undefined>;
  put(request: Request, response: Response): Promise<void>;
}

interface CfCachesLike {
  default: CfCacheLike;
}

function getDefaultCache(): CfCacheLike | null {
  const g = globalThis as unknown as { caches?: CfCachesLike };
  return g.caches?.default ?? null;
}

/**
 * Wrap a response builder with `caches.default` semantics.
 *
 * - On HIT: returns the cached response immediately, header `x-edge-cache: HIT`.
 * - On MISS: invokes `build()`, sets `Cache-Control: public, s-maxage=<ttl>,
 *   stale-while-revalidate=<2×ttl>` (only if the builder didn't set its own),
 *   stores the clone in `caches.default`, returns the original with header
 *   `x-edge-cache: MISS`.
 * - Method must be GET; non-GET bypasses cache entirely.
 * - Returns `build()` output unchanged when CF Caches API is unavailable.
 */
export async function withEdgeCache(
  request: Request,
  ttlSec: number,
  build: () => Promise<Response>,
): Promise<Response> {
  if (request.method !== 'GET') return build();

  const cache = getDefaultCache();
  if (!cache) {
    // Runtime without Cache API (local dev, test). Just build + return.
    const fresh = await build();
    fresh.headers.set('x-edge-cache', 'BYPASS');
    return fresh;
  }

  const cached = await cache.match(request);
  if (cached) {
    const hit = new Response(cached.body, cached);
    hit.headers.set('x-edge-cache', 'HIT');
    return hit;
  }

  const fresh = await build();
  // Only set Cache-Control if the builder didn't — let callers override.
  if (!fresh.headers.has('cache-control')) {
    fresh.headers.set(
      'cache-control',
      `public, s-maxage=${ttlSec}, stale-while-revalidate=${ttlSec * 2}`,
    );
  }
  fresh.headers.set('x-edge-cache', 'MISS');

  // Clone before consuming the body via `put`. cache.put streams the body
  // out, so we keep a copy for the caller.
  const cachable = fresh.clone();
  // Fire-and-forget — don't block response on cache write.
  void cache.put(request, cachable);

  return fresh;
}
