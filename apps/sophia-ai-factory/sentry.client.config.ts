/**
 * Sentry client-side configuration — thin wrapper.
 * All sample rates and PII handling live in lib/observability/sentry-options.ts
 * so client/server/edge cannot drift apart (Round-11 F-PC-11 / Wave-10 Q2).
 */
import * as Sentry from '@sentry/nextjs';
import { buildClientOptions } from '@/land/observability/sentry-options';

Sentry.init({
  ...buildClientOptions(),
  integrations: [Sentry.replayIntegration()],
  enabled: process.env.NODE_ENV === 'production',
  debug: false,
});
