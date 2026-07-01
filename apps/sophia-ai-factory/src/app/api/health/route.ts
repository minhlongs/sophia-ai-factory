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
  } catch {
    // M5: do not expose internal error details (String(e) leaks stack traces / internal hostnames)
    return new Response(JSON.stringify({ status: 'unhealthy', error: 'Service temporarily unavailable' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
