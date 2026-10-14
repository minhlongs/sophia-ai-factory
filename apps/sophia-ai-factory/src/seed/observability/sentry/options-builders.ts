/**
 * Sentry Runtime Options Builders (Client, Server, Edge)
 *
 * Layer: seed/observability/sentry
 */

import type { BrowserOptions, NodeOptions } from '@sentry/nextjs';
import {
  getDSN,
  getRelease,
  getEnvironment,
  getIsProd,
  IGNORE_ERRORS,
  type EdgeOptions,
} from './constants';
import {
  buildBeforeBreadcrumb,
  should4xxBeDropped,
  stripPii,
  tagCronRoute,
} from './sanitizer';

export function buildClientOptions(): BrowserOptions {
  const isProd = getIsProd();
  return {
    dsn: getDSN(),
    release: getRelease(),
    environment: getEnvironment(),
    // Round-11 F-PC-6 / Wave-10 Q2: free-tier-friendly sampling.
    tracesSampleRate: isProd ? 0.02 : 1.0,
    replaysSessionSampleRate: isProd ? 0.01 : 0,
    replaysOnErrorSampleRate: isProd ? 1.0 : 0,
    ignoreErrors: IGNORE_ERRORS,
    beforeBreadcrumb: buildBeforeBreadcrumb,
    beforeSend(event) {
      const statusCode = (event.contexts?.response as Record<string, unknown> | undefined)
        ?.status_code as number | undefined;
      if (should4xxBeDropped(statusCode)) return null;
      return stripPii(event);
    },
  };
}

export function buildServerOptions(): NodeOptions {
  const isProd = getIsProd();
  return {
    dsn: getDSN(),
    release: getRelease(),
    environment: getEnvironment(),
    tracesSampleRate: isProd ? 0.05 : 1.0,
    ignoreErrors: IGNORE_ERRORS,
    beforeBreadcrumb: buildBeforeBreadcrumb,
    beforeSend(event) {
      const statusCode = (event.contexts?.response as Record<string, unknown> | undefined)
        ?.status_code as number | undefined;
      if (should4xxBeDropped(statusCode)) return null;
      // Tag cron route so Sentry alert rules can filter on cron_route dimension (OG-002)
      tagCronRoute(event);
      return stripPii(event);
    },
  };
}

export function buildEdgeOptions(): EdgeOptions {
  const isProd = getIsProd();
  return {
    dsn: getDSN(),
    release: getRelease(),
    environment: getEnvironment(),
    tracesSampleRate: isProd ? 0.05 : 1.0,
    ignoreErrors: IGNORE_ERRORS,
    beforeBreadcrumb: buildBeforeBreadcrumb,
    beforeSend(event) {
      const statusCode = (event.contexts?.response as Record<string, unknown> | undefined)
        ?.status_code as number | undefined;
      if (should4xxBeDropped(statusCode)) return null;
      return stripPii(event);
    },
  };
}
