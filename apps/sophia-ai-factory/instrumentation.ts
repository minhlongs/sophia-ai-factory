export async function register(): Promise<void> {
  // OTEL SDK imports Node.js builtins (http, fs, etc.) unsupported in Edge runtime.
  // Dynamic import ensures the heavy OTEL chunk is never loaded in Cloudflare Workers.
  try {
    const { initializeOTel } = await import('@/seed/telemetry/opentelemetry-setup');
    await initializeOTel();
  } catch (err) {
    // OTEL failure is non-fatal — app must still serve traffic.
    // Honeycomb API key may be missing in dev/local; that's expected.
    console.error('[instrumentation] OTel initialization failed:', err);
  }
}
