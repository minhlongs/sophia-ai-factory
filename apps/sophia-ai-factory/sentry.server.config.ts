/**
 * Sentry server-side initialization — runs on Cloudflare Workers via OpenNext.
 * No profiling integration (CF Workers runtime does not support Node profiler).
 * https://docs.sentry.io/platforms/javascript/guides/nextjs/
 */
import * as Sentry from '@sentry/nextjs';
import { buildServerOptions } from '@/lib/observability/sentry-options';

Sentry.init(buildServerOptions());
