/**
 * Sentry edge runtime configuration — thin wrapper.
 * Centralized options in lib/observability/sentry-options.ts.
 */
import * as Sentry from '@sentry/nextjs';
import { buildEdgeOptions } from '@/seed/observability/sentry-options';

Sentry.init({
  ...buildEdgeOptions(),
  enabled: process.env.NODE_ENV === 'production',
  debug: false,
});
