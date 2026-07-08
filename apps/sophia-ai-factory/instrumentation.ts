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
async function getInitializeOTel(): Promise<void> {
  if (!_initializeOTel) {
    const mod = await import('@/seed/telemetry/opentelemetry-setup');
    _initializeOTel = mod.initializeOTel;
  }
  // Invoke the cached initializer (safe — initializeOTel is idempotent).
  // Previously this returned the function reference without calling it,
  // so register() would await a function value that resolved immediately
  // and fakeInit was never invoked in tests.
  return _initializeOTel();
}

/** Detect Cloudflare Workers edge runtime. */
function isWorkersRuntime(): boolean {
  // jsdom (test) and Node.js both have `process`. In both, `process.env`
  // is the authoritative discriminator when set by the runtime:
  //   Node.js build  → process.env.NEXT_RUNTIME = 'node'
  //   Workers build  → process.env.NEXT_RUNTIME = 'edge'
  // If neither is set (e.g. bare jsdom without Next.js runtime), process
  // exists but process.versions.node is absent — treat as Workers to stay safe.
  const proc = (globalThis as unknown as { process?: { env?: { NEXT_RUNTIME?: string }; versions?: { node?: string } } }).process;
  if (proc?.env?.NEXT_RUNTIME === 'node') return false;
  if (proc?.env?.NEXT_RUNTIME === 'edge') return true;
  // No NEXT_RUNTIME set — fall back to process.versions.node absence (jsdom + Workers both lack it)
  // nodejs_compat polyfills process.versions.node in Workers, so absence
  // is no longer a reliable signal. Use definitive Workers markers instead.
  if (typeof (globalThis as Record<string, unknown>).cf !== 'undefined') return true; // CF Request.cf
  if (typeof (globalThis as Record<string, unknown>).FF_DEBUG !== 'undefined') return true; // CF runtime flag
  if (typeof (globalThis as Record<string, unknown>).EdgeRuntime !== 'undefined') return true; // CF edge
  return false;
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

/**
 * Test-only shim: inject an initializeOTel implementation directly into the
 * module-scoped cache, bypassing the dynamic import entirely.
 *
 * WHY: vitest `vi.mock()` does not intercept dynamic `import()` calls resolved
 * through Vite path aliases. Direct module-scope patching works because
 * `_initializeOTel` is set at module level and consumed by `getInitializeOTel`.
 *
 * @internal — NOT part of the public API. Tests use this to verify
 * Workers-detection and error paths without loading Node.js-only
 * @opentelemetry/* packages.
 */
export function __setInitializeOTelForTests(impl?: () => Promise<void>): void {
  _initializeOTel = impl ?? null;
}
