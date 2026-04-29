/**
 * Sentry client-side configuration
 * Next.js App Router — client components
 */
import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Replay integration for debugging sessions
  integrations: [
    Sentry.replayIntegration(),
  ],

  // Performance monitoring
  tracesSampleRate: 0.1,

  // Capture 10% of sessions for replay
  replaysSessionSampleRate: 0.1,
  // Capture 100% of sessions with errors
  replaysOnErrorSampleRate: 1.0,

  // Only enable in production
  enabled: process.env.NODE_ENV === 'production',

  debug: false,
});
