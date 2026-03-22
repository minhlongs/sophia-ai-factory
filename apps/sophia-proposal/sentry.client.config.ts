/**
 * Sentry Configuration for Sophia AI Factory
 *
 * Error tracking and performance monitoring
 * Docs: https://docs.sentry.io/platforms/javascript/guides/nextjs/
 */

import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Performance Monitoring
  tracesSampleRate: 1.0,

  // Error Sampling
  sampleRate: 1.0,

  // Environment
  environment: process.env.NODE_ENV || 'development',

  // Release tracking
  release: process.env.VERCEL_GIT_COMMIT_SHA || 'development',

  // Integrations
  integrations: [
    Sentry.replayIntegration({
      maskAllText: true,
      blockAllMedia: true,
    }),
  ],

  // Session Replay
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,

  // Ignore specific errors
  ignoreErrors: [
    'NetworkError',
    'Request failed',
    'Loading chunk',
    /ResizeObserver loop limit exceeded/,
  ],

  // Before send hook for filtering
  beforeSend(event: any, hint: any) {
    // Don't send events in development
    if (process.env.NODE_ENV === 'development') {
      console.error('[Sentry]', event);
      return null;
    }
    return event;
  },
});
