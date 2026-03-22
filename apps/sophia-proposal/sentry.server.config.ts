/**
 * Sentry Server Configuration
 */

import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Performance Monitoring
  tracesSampleRate: 0.1, // Capture 10% for production

  // Error Sampling
  sampleRate: 1.0,

  // Environment
  environment: process.env.NODE_ENV || 'production',

  // Release tracking
  release: process.env.VERCEL_GIT_COMMIT_SHA || 'development',

  // Ignore specific errors
  ignoreErrors: [
    'NetworkError',
    'Request failed',
    /ResizeObserver loop limit exceeded/,
  ],

  // Before send hook
  beforeSend(event: any, hint: any) {
    if (process.env.NODE_ENV === 'development') {
      return null;
    }
    return event;
  },
});
