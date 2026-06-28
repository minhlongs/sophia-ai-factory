/**
 * Health proxy — forwards to dedicated health worker
 * Minimal code to avoid OpenNext chunking issues
 */
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const healthRes = await fetch('https://sophia-ai-factory-health.agencyos-openclaw.workers.dev/api/health', {
      cf: { cacheTtl: 0, cacheEverything: false }
    });
    const data = await healthRes.json();
    return new Response(JSON.stringify(data), {
      status: healthRes.status,
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-cache, no-store, must-revalidate' }
    });
  } catch (e) {
    return new Response(JSON.stringify({ status: 'unhealthy', error: 'Proxy failed', details: String(e) }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
