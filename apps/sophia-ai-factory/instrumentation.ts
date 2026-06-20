/**
 * Next.js Instrumentation hook for OpenTelemetry.
 * This runs in both Node.js (server) and browser environments.
 *
 * For Cloudflare Workers (our target), we use the browser-compatible OTel SDK
 * with HTTP OTLP exporter to Honeycomb.
 */

import { initializeOTel } from '@/seed/telemetry/opentelemetry-setup';

export async function register(): Promise<void> {
  try {
    // Initialize OpenTelemetry - this sets up global tracer and fetch instrumentation
    await initializeOTel();
    console.log('[instrumentation] OpenTelemetry initialized successfully');
  } catch (error) {
    console.error('[instrumentation] OpenTelemetry initialization failed:', error);
    // Fail gracefully - app continues to work without telemetry
  }
}
