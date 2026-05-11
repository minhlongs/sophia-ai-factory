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
  // tagCache stays default ("dummy") — full tag invalidation needs
  // d1-next-tag-cache which adds another table. Time-based revalidate covers
  // our current needs.
});
