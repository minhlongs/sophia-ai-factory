import { NextRequest, NextResponse } from "next/server";
import { withEdgeCache } from "@/seed/cache/edge-cache";

// IMPORTANT: do NOT add `export const revalidate = N` here. The route reads
// COMMIT_SHA / DEPLOYED_AT from the runtime env. `revalidate` opts the route
// into build-time static generation where those env vars are empty, baking
// `shortSha: "unknown"` into the cached response. Use Cache-Control headers
// (set on the return) instead — they let downstream proxies cache without
// forcing build-time rendering.
export const dynamic = "force-dynamic";

// RED-TEAM #10: Public response returns short SHA only.
// Full SHA + branch + commitMsg gated behind INTROSPECT_TOKEN bearer.

interface CloudflareEnv {
  COMMIT_SHA?: string;
  DEPLOYED_AT?: string;
  DEPLOY_BRANCH?: string;
  INTROSPECT_TOKEN?: string;
}

interface PublicVersionResponse {
  shortSha: string;
  deployedAt: string;
  opennextVersion: string;
}

interface FullVersionResponse extends PublicVersionResponse {
  commitSha: string;
  branch: string;
}

const OPENNEXT_VERSION = "1.19.9";

function getEnv(request: NextRequest): CloudflareEnv {
  // CF Workers exposes env via request context; Next.js falls back to process.env
  const ctx = (request as NextRequest & { env?: CloudflareEnv }).env;
  return {
    COMMIT_SHA: ctx?.COMMIT_SHA ?? process.env.COMMIT_SHA,
    DEPLOYED_AT: ctx?.DEPLOYED_AT ?? process.env.DEPLOYED_AT,
    DEPLOY_BRANCH: ctx?.DEPLOY_BRANCH ?? process.env.DEPLOY_BRANCH,
    INTROSPECT_TOKEN: ctx?.INTROSPECT_TOKEN ?? process.env.INTROSPECT_TOKEN,
  };
}

function isIntrospectAuthorized(request: NextRequest, env: CloudflareEnv): boolean {
  const token = env.INTROSPECT_TOKEN;
  if (!token) return false;
  const auth = request.headers.get("authorization") ?? "";
  return auth === `Bearer ${token}`;
}

// Public payload is deploy-stable for 60s — the only field that ever changes
// between identical SHAs is `deployedAt`, and re-render cost outweighs the
// staleness signal for the typical caller (uptime probes + load balancers).
const PUBLIC_CACHE_HEADERS = {
  "Cache-Control": "public, max-age=30, s-maxage=60, stale-while-revalidate=120",
} as const;

export async function GET(request: NextRequest): Promise<Response> {
  const env = getEnv(request);

  // Authorized path: always fresh, never cached.
  if (isIntrospectAuthorized(request, env)) {
    const commitSha = env.COMMIT_SHA ?? "unknown";
    const fullBody: FullVersionResponse = {
      shortSha: commitSha.slice(0, 8),
      deployedAt: env.DEPLOYED_AT ?? new Date().toISOString(),
      opennextVersion: OPENNEXT_VERSION,
      commitSha,
      branch: env.DEPLOY_BRANCH ?? "unknown",
    };
    return NextResponse.json(fullBody);
  }

  // Anonymous path: wrap with `caches.default` so CF edge serves repeat hits
  // without invoking the Worker. Builder runs only on cache miss.
  return withEdgeCache(request, 60, async () => {
    const commitSha = env.COMMIT_SHA ?? "unknown";
    const publicBody: PublicVersionResponse = {
      shortSha: commitSha.slice(0, 8),
      deployedAt: env.DEPLOYED_AT ?? new Date().toISOString(),
      opennextVersion: OPENNEXT_VERSION,
    };
    return NextResponse.json(publicBody, { headers: PUBLIC_CACHE_HEADERS });
  });
}
