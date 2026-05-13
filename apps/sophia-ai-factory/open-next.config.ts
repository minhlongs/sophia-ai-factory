// R2 incremental cache: rendered HTML + fetch cache persisted in
// NEXT_INC_CACHE_R2_BUCKET binding (sophia-ai-factory-opennext-cache).
// Enables ISR `revalidate` directives to actually cache between Worker
// invocations instead of re-rendering on every request.
//
// Uses defineCloudflareConfig (modern @opennextjs/cloudflare 1.x API) which
// fills in cloudflare-node/cloudflare-edge wrappers + edge converter defaults
// automatically. We retain the redis/ioredis edgeExternals from the prior raw
// config — these packages are pulled in by indirect deps but never reached at
// runtime in our Workers path.

import { defineCloudflareConfig } from "@opennextjs/cloudflare";
import r2IncrementalCache from "@opennextjs/cloudflare/overrides/incremental-cache/r2-incremental-cache";

export default defineCloudflareConfig({
  incrementalCache: r2IncrementalCache,
  // tagCache stays default ("dummy") — d1NextTagCache requires a SEPARATE D1
  // instance bound as `NEXT_TAG_CACHE_D1`. Wrangler does NOT allow aliasing
  // a single database_id to two bindings (verified Phase 5 attempt 2026-05-13:
  // `populateD1TagCache` errored "No D1 binding NEXT_TAG_CACHE_D1 found!"
  // when both bindings shared sophia-raas-db). Provisioning a second D1
  // instance is out of scope for this phase — time-based ISR via s-maxage
  // continues to cover marketing/dashboard freshness needs adequately.
  // Migration `0108-opennext-tag-cache.sql` was applied to sophia-raas-db
  // for the table (harmless residual; unused until tagCache flipped on).
  // Future: create `sophia-tag-cache` D1, point NEXT_TAG_CACHE_D1 binding
  // at it, restore `tagCache: d1NextTagCache` line.
});
