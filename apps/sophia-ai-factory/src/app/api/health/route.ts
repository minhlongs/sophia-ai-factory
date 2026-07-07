/**
 * Health endpoint — local health check for Cloudflare Workers runtime.
 *
 * Verifies the worker is alive and responds. Does NOT proxy to external services.
 * Used by uptime monitors and load balancers.
 */
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    // Note: in Cloudflare Workers, process is polyfilled by Turbopack but
    // process.uptime() and process.env are not available. Use env accessor
    // if present (Workers inject NODE_ENV into process.env via polyfill),
    // otherwise fall back to safe defaults.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const proc = (globalThis as any).process;
    const nodeEnv = typeof proc?.env?.NODE_ENV === 'string'
      ? proc.env.NODE_ENV
      : 'production';
    const uptime = typeof proc?.uptime === 'function'
      ? Math.floor(proc.uptime())
      : 0;

    const health = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime,
      environment: nodeEnv,
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
