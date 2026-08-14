/**
 * Instrument API route handlers with OpenTelemetry spans.
 * Wraps a Next.js App Router route handler to create spans and record metrics.
 */

import { getTracer } from '@/seed/telemetry/opentelemetry-setup';
import { record as recordMetrics } from '@/seed/observability/telemetry/metrics';

/**
 * Options for instrumenting a route.
 */
type AsyncHandler = (...args: never[]) => Promise<unknown>;

function getResponseStatus(result: unknown): number {
  if (typeof result === 'object' && result !== null && 'status' in result) {
    const status = (result as { status?: unknown }).status;
    if (typeof status === 'number') return status;
  }
  return 200;
}

export interface InstrumentationOptions {
  /** Route path pattern (e.g., '/api/campaigns') */
  route: string;
  /** HTTP method (GET, POST, etc.) */
  method: string;
}

/**
 * Wrap an API route handler with tracing and metrics.
 * Usage:
 *   export const GET = instrumentRoute({ route: '/api/campaigns', method: 'GET' }, async (request) => {
 *     // handler logic
 *   });
 */
export function instrumentRoute<T extends AsyncHandler>(
  options: InstrumentationOptions,
  handler: T
): T {
  return ((...args: Parameters<T>) => {
    const startTime = Date.now();
    const tracer = getTracer();
    const spanName = `api.${options.method.toLowerCase()}.${options.route.replace(/\//g, '.')}`;

    const span = tracer.startSpan(spanName, {
      attributes: {
        'http.method': options.method,
        'http.route': options.route,
        'component': 'api',
      },
    });

    // Attach span context to request headers for downstream fetch propagation
    // (Next.js doesn't provide request object modification, but OTel fetch instrumentation picks up from context)

    let result: unknown;
    return handler(...args)
      .then((res: unknown) => {
        result = res;
        // Record status based on response code if available
        const status = getResponseStatus(result);
        if (status >= 400) {
          span.setStatus({ code: 1 /* ERROR */, message: `HTTP ${status}` });
        }
        span.setAttribute('http.status_code', status);
        return result;
      })
      .catch((err: unknown) => {
        const error = err instanceof Error ? err : new Error(String(err));
        span.recordException(error);
        span.setStatus({ code: 1 /* ERROR */, message: error.message });
        throw err;
      })
      .finally(() => {
        const duration = Date.now() - startTime;
        span.setAttribute('duration_ms', duration);
        span.end();

        // Record metrics (in-memory ring buffer)
        const isError = typeof result !== 'undefined' ? getResponseStatus(result) >= 400 : true;
        recordMetrics(options.route, duration, isError);
      });
  }) as T;
}

/**
 * Instrument a route without wrapping — just add span creation inside handler.
 * Use when you need more control over span lifecycle.
 */
export function createRouteSpan(options: InstrumentationOptions) {
  const tracer = getTracer();
  const spanName = `api.${options.method.toLowerCase()}.${options.route.replace(/\//g, '.')}`;

  return tracer.startSpan(spanName, {
    attributes: {
      'http.method': options.method,
      'http.route': options.route,
      'component': 'api',
    },
  });
}
