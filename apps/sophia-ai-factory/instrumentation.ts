// Cloudflare Workers doesn't support Node.js builtins (http, fs, zlib) that OTEL SDK requires.
// OTEL must NOT be statically imported — doing so evaluates its Node.js imports at module load,
// which crashes Workers before any runtime check runs. Use dynamic import inside register().
const isWorkers = typeof navigator !== 'undefined' && navigator.userAgent?.includes('Cloudflare-Workers');

export async function register(): Promise<void> {
  if (isWorkers) {
    console.log('[instrumentation] Skipping OTel init in Cloudflare Workers');
    return;
  }
  try {
    const { initializeOTel } = await import('@/seed/telemetry/opentelemetry-setup');
    await initializeOTel();
  } catch (err) {
    // OTEL failure is non-fatal — app must still serve traffic
    console.error('[instrumentation] OTel init failed:', err);
  }
}