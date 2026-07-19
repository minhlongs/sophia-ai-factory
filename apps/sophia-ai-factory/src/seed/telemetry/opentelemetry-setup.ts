/**
 * OpenTelemetry stub for Cloudflare Workers.
 *
 * Cloudflare Workers cannot bundle @opentelemetry/* because those packages
 * depend on Node.js builtins (events, http, zlib, fs) that crash the V8 isolate.
 *
 * This file provides no-op fallbacks so any lingering imports don't throw.
 * All OTel functionality is available only in the Node.js Inngest worker.
 */

// No @opentelemetry imports — avoid pulling OTel packages into the Workers bundle.

interface NoOpSpan {
  setStatus(_s: { code?: number; message?: string }): void;
  setAttribute(_name: string, _value: unknown): void;
  setAttributes(_attrs: Record<string, unknown>): void;
  recordException(_exception: unknown): void;
  end(): void;
  addEvent(_name: string, ..._args: unknown[]): void;
}

const NOOP_SPAN: NoOpSpan = {
  setStatus: () => {},
  setAttribute: () => {},
  setAttributes: () => {},
  recordException: () => {},
  end: () => {},
  addEvent: () => {},
};

type NoOpTracer = {
  startSpan(_name: string, _options?: unknown): NoOpSpan;
};

let _noopTracer: NoOpTracer = {
  startSpan: () => ({ ...NOOP_SPAN }),
};

/** No-op — safe to call anywhere, including Workers. */
export async function initializeOTel(): Promise<void> {
  // Stub: OTel only runs in the Node.js Inngest worker.
}

/** Returns a no-op tracer that silently discards spans. */
export function getTracer(): NoOpTracer {
  return _noopTracer;
}

/** No-op — spans are silently discarded. */
export function startSpan(_name: string, _options?: unknown): NoOpSpan {
  return _noopTracer.startSpan(_name, _options);
}

/** No-op shutdown. */
export async function shutdown(): Promise<void> {
  // Nothing to clean up in Workers runtime.
}
