import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Performance Monitoring
  tracesSampleRate: 0.1,

  // Environment
  environment: process.env.NODE_ENV || 'production',

  // Release tracking
  release: process.env.VERCEL_GIT_COMMIT_SHA || 'development',
});
