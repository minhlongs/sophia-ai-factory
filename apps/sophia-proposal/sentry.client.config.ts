/**
 * Sentry client-side configuration.
 * Initializes browser error tracking only when NEXT_PUBLIC_SENTRY_DSN is set.
 * DSN is configured per-environment — set it in Cloudflare env vars or .env.local.
 */

import * as Sentry from '@sentry/nextjs';

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

// No-op if DSN not configured
if (dsn && dsn !== 'https://placeholder@sentry.io/0') {
  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV,
    tracesSampleRate: 0.1,
    // Disable Sentry debug output in production
    debug: false,
  });
}
