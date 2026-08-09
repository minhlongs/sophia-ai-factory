import { initializeOTel } from '@/seed/telemetry/opentelemetry-setup';

// Cloudflare Workers doesn't support Node.js builtins (http, fs, zlib) that OTEL SDK requires.
// Skip instrumentation entirely in Workers — it runs in Node.js dev/preview environments.
const isWorkers = typeof navigator !== 'undefined' && navigator.userAgent?.includes('Cloudflare-Workers');

export async function register(): Promise<void> {
  if (isWorkers) {
    console.log('[instrumentation] Skipping OTel init in Cloudflare Workers');
    return;
  }
  try {
    await initializeOTel();
  } catch (err) {
    // OTEL failure is non-fatal — app must still serve traffic
    console.error('[instrumentation] OTel init failed:', err);
  }
}