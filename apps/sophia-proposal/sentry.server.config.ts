/**
 * Sentry server-side configuration.
 * Initializes server error tracking only when NEXT_PUBLIC_SENTRY_DSN is set.
 * Runs in Node.js server context (API routes, server components).
 */

import * as Sentry from '@sentry/nextjs';

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

// No-op if DSN not configured or still using placeholder
if (dsn && dsn !== 'https://placeholder@sentry.io/0') {
  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV,
    tracesSampleRate: 0.1,
    debug: false,
  });
}
