/**
 * Sentry server-side configuration
 * Next.js App Router — server components, API routes, Server Actions
 */
import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Performance monitoring — Round-11 F-PC-6: dropped to 0.05 (server has fewer
  // events than client; keep slightly higher signal but still under free-tier).
  tracesSampleRate: 0.05,

  // Only enable in production
  enabled: process.env.NODE_ENV === 'production',

  debug: false,
});
