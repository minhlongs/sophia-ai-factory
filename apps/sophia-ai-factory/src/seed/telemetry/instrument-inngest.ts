/**
 * Instrument Inngest event handlers with OpenTelemetry spans.
 */

import { getTracer } from '@/seed/telemetry/opentelemetry-setup'

/**
 * Wrap an Inngest function handler with tracing.
 * The wrapper creates a span named after the event and records duration/errors.
 *
 * Usage:
 *   export const generateCampaign = instrumentInngest('generate_campaign', async ({ event, step }) => {
 *     // handler logic
 *   });
 */
type AsyncHandler = (...args: never[]) => Promise<unknown>;

export function instrumentInngest<T extends AsyncHandler>(
  eventName: string,
  handler: T
): T {
  return ((...args: Parameters<T>) => {
    const tracer = getTracer();
    const span = tracer.startSpan(`inngest.${eventName}`, {
      attributes: {
        'inngest.event': eventName,
        component: 'inngest',
      },
    });

    const startTime = Date.now();

    return handler(...args)
      .then((result: unknown) => result)
      .catch((err: unknown) => {
        const error = err instanceof Error ? err : new Error(String(err));
        span.recordException(error);
        span.setStatus({ code: 1, message: error.message });
        throw err;
      })
      .finally(() => {
        const duration = Date.now() - startTime;
        span.setAttribute('duration_ms', duration);
        span.end();
      });
  }) as T;
}

/**
 * Manually create an Inngest span inside a handler.
 * Useful when you need more control over span lifecycle.
 */
export function createInngestSpan(eventName: string) {
  const tracer = getTracer();
  const span = tracer.startSpan(`inngest.${eventName}`, {
    attributes: {
      'inngest.event': eventName,
      component: 'inngest',
    },
  });
  const startTime = Date.now();

  return {
    span,
    finish: (error?: Error) => {
      const duration = Date.now() - startTime;
      if (error) {
        span.recordException(error);
        span.setStatus({ code: 1, message: error.message });
      }
      span.setAttribute('duration_ms', duration);
      span.end();
    },
    recordException: (err: Error) => span.recordException(err),
  };
}
