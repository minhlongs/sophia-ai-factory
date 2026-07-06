import { initializeOTel } from '@/seed/telemetry/opentelemetry-setup';

export async function register(): Promise<void> {
  try {
    await initializeOTel();
  } catch (err) {
    // OTEL failure is non-fatal — app must still serve traffic.
    // console.error is acceptable here: instrument runs before the
    // application logger is initialized, so structured logging is unavailable.
    // eslint-disable-next-line no-console
    console.error('[instrumentation] OTel init failed:', err);
  }
}
