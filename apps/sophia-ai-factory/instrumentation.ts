/**
 * Next.js instrumentation hook — Sophia AI Factory.
 *
 * OTel is Node.js-only (uses http/zlib/fs builtins). Skip initialization
 * automatically when running in Cloudflare Workers edge runtime.
 */

// NOTE: Dynamic import prevents Node.js-only OTel modules from being
// bundled into the Cloudflare Worker. The static ESM graph must not
// reference @opentelemetry/* packages in Workers runtime.
let _initializeOTel: (() => Promise<void>) | null = null;
async function getInitializeOTel() {
  if (!_initializeOTel) {
    const mod = await import('@/seed/telemetry/opentelemetry-setup');
    _initializeOTel = mod.initializeOTel;
  }
  return _initializeOTel;
}

/**
 * Detect Cloudflare Workers edge runtime.
 *
 * Turbopack (used by Next.js in Workers builds) polyfills a minimal `process`
 * object, so `typeof process === 'undefined'` is unreliable. The reliable
 * discriminator is `process.versions?.node`: in Node.js it is a non-empty
 * string (e.g. "v22.15.0"); in Workers (even with the Turbopack polyfill)
 * the property does not exist.
 */
function isWorkersRuntime(): boolean {
  const proc = (globalThis as unknown as { process?: { versions?: { node?: string } } })
    .process;
  return proc !== undefined && !proc.versions?.node;
}

export async function register(): Promise<void> {
  if (isWorkersRuntime()) {
    return; // OTel uses Node.js builtins — silently no-op in Workers
  }

  try {
    await getInitializeOTel();
  } catch (err) {
    // OTEL failure is non-fatal — app must still serve traffic.
    // console.error is acceptable here: instrumentation runs before the
    // application logger is initialized, so structured logging is unavailable.
    // eslint-disable-next-line no-console
    console.error('[instrumentation] OTel init failed:', err);
  }
}
