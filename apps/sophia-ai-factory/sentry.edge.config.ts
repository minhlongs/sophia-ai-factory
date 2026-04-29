/**
 * Sentry edge runtime configuration
 * Next.js App Router — middleware, edge API routes
 */
import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Performance monitoring (lower rate for edge)
  tracesSampleRate: 0.05,

  // Only enable in production
  enabled: process.env.NODE_ENV === 'production',

  debug: false,
});
