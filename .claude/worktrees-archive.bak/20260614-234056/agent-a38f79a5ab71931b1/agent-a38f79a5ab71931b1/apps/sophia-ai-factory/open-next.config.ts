import { defineCloudflareConfig } from "@opennextjs/cloudflare";
import r2IncrementalCache from "@opennextjs/cloudflare/overrides/incremental-cache/r2-incremental-cache";
import d1NextTagCache from "@opennextjs/cloudflare/overrides/tag-cache/d1-next-tag-cache";

// TypeScript types don't expose `default`/`middleware` wrapper keys, but OpenNext
// runtime (ensure-cf-config.js) REQUIRES them. Cast to any to satisfy both.
const config = {
  default: {
    override: {
      wrapper: "cloudflare-node",
      converter: "edge",
      proxyExternalRequest: "fetch",
      incrementalCache: "dummy", // R2 disabled (CF error 10042); dummy satisfies schema.
      tagCache: d1NextTagCache,  // D1-backed tag invalidation (sophia-tag-cache).
    },
  },
  edgeExternals: ["node:crypto"],
  middleware: {
    external: true,
    override: {
      wrapper: "cloudflare-edge",
      converter: "edge",
      proxyExternalRequest: "fetch",
      incrementalCache: "dummy", // Middleware ISR also skips R2.
    },
  },
} as any;

export default defineCloudflareConfig(config);
