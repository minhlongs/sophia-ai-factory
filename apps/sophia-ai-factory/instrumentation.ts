import { initializeOTel } from '@/seed/telemetry/opentelemetry-setup';

export async function register(): Promise<void> {
  try {
    await initializeOTel();
  } catch (err) {
    // OTEL failure is non-fatal — app must still serve traffic.
    // Honeycomb API key may be missing in dev/local; that's expected.
    console.error('[instrumentation] OTel initialization failed:', err);
  }
}
