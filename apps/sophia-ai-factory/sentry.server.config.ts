/**
 * Sentry server-side configuration — thin wrapper.
 * Centralized options in lib/observability/sentry-options.ts.
 */
import * as Sentry from '@sentry/nextjs';
import { buildServerOptions } from '@/lib/observability/sentry-options';

Sentry.init({
  ...buildServerOptions(),
  enabled: process.env.NODE_ENV === 'production',
  debug: false,
});
