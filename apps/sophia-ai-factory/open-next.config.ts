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
import d1NextTagCache from "@opennextjs/cloudflare/overrides/tag-cache/d1-next-tag-cache";

export default defineCloudflareConfig({
  incrementalCache: r2IncrementalCache,
  // Real tag invalidation (Fullstack Phase 5.1 G11 — 2026-05-13).
  // `revalidateTag()` / `revalidatePath()` from Server Actions now flush the
  // matching cache entries instead of being no-ops. Backed by dedicated
  // sophia-tag-cache D1 instance (binding NEXT_TAG_CACHE_D1 in wrangler.toml,
  // table `revalidations` created by migration 0108-opennext-tag-cache.sql).
  // The previous attempt aliasing sophia-raas-db to two binding names failed
  // because wrangler rejects duplicate database_id with different bindings.
  tagCache: d1NextTagCache,
});
