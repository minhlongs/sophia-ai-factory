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

  // Performance monitoring — Round-11 F-PC-6: dropped from 0.1 to 0.02 to fit
  // free-tier monthly quota (10k transactions). Bump back when on paid plan.
  tracesSampleRate: 0.02,

  // Capture 1% of sessions for replay (was 10% — replay quota burns fastest).
  replaysSessionSampleRate: 0.01,
  // Capture 100% of sessions with errors — cheap and high signal.
  replaysOnErrorSampleRate: 1.0,

  // Only enable in production
  enabled: process.env.NODE_ENV === 'production',

  debug: false,
});
