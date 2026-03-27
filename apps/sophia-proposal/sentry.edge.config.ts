/**
 * Sentry edge runtime configuration.
 * Initializes error tracking for middleware and edge API routes.
 * Edge runtime runs in CF Workers — lightweight subset of Node.js.
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
