/**
 * Next.js instrumentation hook — wires OpenTelemetry into the worker runtime.
 *
 * Called once per cold start by the worker runtime. Failures are swallowed:
 * OTEL is non-critical observability; the platform must boot regardless of
 * whether Honeycomb is configured.
 *
 * The Honeycomb API key is read by initializeOTel() from platform_configs
 * (BYOK) or HONEYCOMB_API_KEY env var. Without a key, OTEL initializes but
 * exporters fail silently (no-op).
 */

export async function register(): Promise<void> {
  try {
    const { initializeOTel } = await import('@/seed/telemetry/opentelemetry-setup');
    await initializeOTel();
  } catch {
    // OTEL failure is non-fatal — platform boots regardless.
    // Diagnostics are logged by initializeOTel() itself.
  }
}
