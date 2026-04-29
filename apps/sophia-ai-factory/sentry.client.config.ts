/**
 * Sentry client-side initialization — loaded by @sentry/nextjs in browser bundle.
 * https://docs.sentry.io/platforms/javascript/guides/nextjs/
 */
import * as Sentry from '@sentry/nextjs';
import { buildClientOptions } from '@/lib/observability/sentry-options';

Sentry.init({
  ...buildClientOptions(),
  // Session replay only on errors in production (privacy-first: maskAllText)
  integrations: [
    Sentry.replayIntegration({
      maskAllText: true,
      blockAllMedia: true,
    }),
  ],
});
