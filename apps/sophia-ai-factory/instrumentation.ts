/**
 * Next.js instrumentation hook — Sophia AI Factory.
 *
 * OTel is Node.js-only (uses http/zlib/fs builtins). Skip initialization
 * automatically when running in Cloudflare Workers edge runtime.
 */

import { initializeOTel } from '@/seed/telemetry/opentelemetry-setup';

const isWorkersRuntime = typeof globalThis !== 'undefined'
  && typeof (globalThis as unknown as Record<string, unknown>).process === 'undefined'
  && typeof (globalThis as unknown as Record<string, unknown>).fetch === 'function'
  && typeof (globalThis as unknown as Record<string, unknown>).window === 'undefined';

export async function register(): Promise<void> {
  if (isWorkersRuntime) {
    return; // OTel uses Node.js builtins — silently no-op in Workers
  }

  try {
    await initializeOTel();
  } catch (err) {
    // OTEL failure is non-fatal — app must still serve traffic.
    // console.error is acceptable here: instrumentation runs before the
    // application logger is initialized, so structured logging is unavailable.
    // eslint-disable-next-line no-console
    console.error('[instrumentation] OTel init failed:', err);
  }
}
