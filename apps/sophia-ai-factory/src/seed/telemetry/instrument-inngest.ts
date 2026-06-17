/**
 * Instrument Inngest event handlers with OpenTelemetry spans.
 */

import { startSpan, getTracer } from '@/seed/telemetry/opentelemetry-setup';

/**
 * Wrap an Inngest function handler with tracing.
 * The wrapper creates a span named after the event and records duration/errors.
 *
 * Usage:
 *   export const generateCampaign = instrumentInngest('generate_campaign', async ({ event, step }) => {
 *     // handler logic
 *   });
 */
export function instrumentInngest<T extends (...args: any[]) => any>(
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
    let isError = false;

    return handler(...args)
      .then((result: any) => {
        isError = false;
        return result;
      })
      .catch((err: Error) => {
        isError = true;
        span.recordException(err);
        span.setStatus({ code: 1, message: err.message });
        throw err;
      })
      .finally(() => {
        const duration = Date.now() - startTime;
        span.setAttribute('duration_ms', duration);
        span.end();
      }) as any;
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
  let isError = false;

  return {
    span,
    finish: (error?: Error) => {
      const duration = Date.now() - startTime;
      if (error) {
        isError = true;
        span.recordException(error);
        span.setStatus({ code: 1, message: error.message });
      }
      span.setAttribute('duration_ms', duration);
      span.end();
    },
    recordException: (err: Error) => span.recordException(err),
  };
}
