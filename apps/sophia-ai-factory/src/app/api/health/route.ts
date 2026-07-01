/**
 * Health endpoint — local health check for Cloudflare Workers runtime.
 *
 * Verifies the worker is alive and responds. Does NOT proxy to external services.
 * Used by uptime monitors and load balancers.
 */
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const health = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: Math.floor(process?.uptime?.() ?? 0),
      environment: process.env.NODE_ENV ?? 'unknown',
    };

    return new Response(JSON.stringify(health), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      },
    });
  } catch {
    return new Response(
      JSON.stringify({ status: 'unhealthy', error: 'Service temporarily unavailable' }),
      {
        status: 503,
        headers: { 'Content-Type': 'application/json' },
      },
    );
  }
}
