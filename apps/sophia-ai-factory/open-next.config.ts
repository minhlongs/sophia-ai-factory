import { defineCloudflareConfig } from "@opennextjs/cloudflare";
import r2IncrementalCache from "@opennextjs/cloudflare/overrides/incremental-cache/r2-incremental-cache";
import d1NextTagCache from "@opennextjs/cloudflare/overrides/tag-cache/d1-next-tag-cache";

const config = {
  default: {
    override: {
      wrapper: "cloudflare-node",
      converter: "edge",
      proxyExternalRequest: "fetch",
      incrementalCache: "dummy",
      tagCache: d1NextTagCache,
      // Externalize heavy/unused packages (external = keep as require() at runtime)
      external: [
        "html2canvas", "recharts", "jszip", "framer-motion",
        "d3", "d3-*",
        "telegraf",
        "@sentry/core", "@sentry/react", "@sentry/nextjs", "@sentry/node",
        "better-sqlite3",
        "@upstash/redis", "upstash", "uncrypto",
        "@better-auth/kysely-adapter",
      ],
    },
  },
  // API function for node-based routes to split from default
  api: {
    override: {
      wrapper: "cloudflare-node",
      converter: "edge",
      proxyExternalRequest: "fetch",
      incrementalCache: "dummy",
      tagCache: d1NextTagCache,
      runtime: "nodejs",
    },
  },
  // Route mapping: more specific patterns first
  functions: {
    "/api/onboarding/:path*": "default", // edge route stays in default
    "/api/:path*": "api", // all other API routes go to 'api' function
  },
  edgeExternals: ["node:crypto"],
  middleware: {
    external: true,
    override: {
      wrapper: "cloudflare-edge",
      converter: "edge",
      proxyExternalRequest: "fetch",
      incrementalCache: "dummy",
      // Also externalize from middleware bundle
      external: [
        "html2canvas", "recharts", "jszip", "framer-motion",
        "d3", "d3-*",
        "telegraf",
        "@sentry/*",
        "better-sqlite3",
        "@upstash/redis", "upstash", "uncrypto",
        "@better-auth/kysely-adapter",
      ],
    },
  },
  // Disable config validation due to known tagCache type issue in ensure-cf-config.js
  cloudflare: {
    dangerousDisableConfigValidation: true,
  },
};
	// @ts-expect-error - known type incompatibility with OpenNext CloudflareOverrides

export default defineCloudflareConfig(config);
