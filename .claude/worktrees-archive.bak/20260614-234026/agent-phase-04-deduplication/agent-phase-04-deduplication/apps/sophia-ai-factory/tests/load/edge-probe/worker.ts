/**
 * Edge-region latency probe.
 *
 * Standalone Cloudflare Worker that times N sequential fetches against the
 * Sophia production URL from inside CF's network. Returns per-route stats so
 * we can separate network jitter (PT origin → CF edge) from app cost (CF edge
 * → CF Worker → R2/D1).
 *
 * Deploy with the colocated wrangler.toml:
 *   cd tests/load/edge-probe && npx wrangler deploy
 *
 * Run:
 *   curl "https://sophia-edge-probe.<your-subdomain>.workers.dev/?n=20"
 *
 * Tear down:
 *   npx wrangler delete sophia-edge-probe
 */

const PROD_URL = "https://sophia.agencyos.network";

const ROUTES = [
  { path: "/", name: "homepage" },
  { path: "/en/pricing", name: "pricing" },
  { path: "/api/health", name: "health" },
  { path: "/api/version", name: "version" },
  { path: "/en/status", name: "status" },
];

interface RouteStat {
  name: string;
  path: string;
  count: number;
  okCount: number;
  min: number;
  avg: number;
  p50: number;
  p95: number;
  max: number;
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length));
  return sorted[idx];
}

async function timeOne(path: string): Promise<{ ms: number; ok: boolean }> {
  const t0 = Date.now();
  try {
    const res = await fetch(`${PROD_URL}${path}`, {
      redirect: "manual", // count the first response, not the redirect chain
      cf: { cacheTtl: 0 } as RequestInit["cf"],
    });
    // Drain body so timing reflects full TTFB + body fetch.
    await res.arrayBuffer();
    return { ms: Date.now() - t0, ok: res.status < 400 };
  } catch {
    return { ms: Date.now() - t0, ok: false };
  }
}

async function runProbe(iterations: number): Promise<RouteStat[]> {
  const samples: Record<string, number[]> = {};
  const okCounts: Record<string, number> = {};
  for (const r of ROUTES) {
    samples[r.name] = [];
    okCounts[r.name] = 0;
  }

  for (let i = 0; i < iterations; i++) {
    for (const r of ROUTES) {
      const result = await timeOne(r.path);
      samples[r.name].push(result.ms);
      if (result.ok) okCounts[r.name]++;
    }
  }

  return ROUTES.map((r) => {
    const sorted = [...samples[r.name]].sort((a, b) => a - b);
    const sum = sorted.reduce((a, b) => a + b, 0);
    return {
      name: r.name,
      path: r.path,
      count: sorted.length,
      okCount: okCounts[r.name],
      min: sorted[0] ?? 0,
      avg: sorted.length ? Math.round(sum / sorted.length) : 0,
      p50: percentile(sorted, 50),
      p95: percentile(sorted, 95),
      max: sorted[sorted.length - 1] ?? 0,
    };
  });
}

interface ProbeEnv {
  [key: string]: unknown;
}

export default {
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const iterations = Math.max(
      1,
      Math.min(50, parseInt(url.searchParams.get("n") ?? "20", 10) || 20),
    );

    const startedAt = new Date().toISOString();
    const stats = await runProbe(iterations);
    const finishedAt = new Date().toISOString();

    return new Response(
      JSON.stringify(
        {
          target: PROD_URL,
          iterations,
          colo: request.cf?.colo ?? "unknown",
          startedAt,
          finishedAt,
          stats,
        },
        null,
        2,
      ),
      { headers: { "content-type": "application/json" } },
    );
  },
} satisfies ExportedHandler<ProbeEnv>;
