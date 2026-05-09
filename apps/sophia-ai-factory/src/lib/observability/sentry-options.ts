/**
 * Sentry shared options — typed builders for client, server, and edge runtimes.
 * Centralizes DSN, sampling, ignoreErrors, and release tagging.
 */
import type { BrowserOptions, NodeOptions } from '@sentry/nextjs';

// EdgeOptions not exported by @sentry/nextjs; edge subset is compatible with NodeOptions
type EdgeOptions = Omit<NodeOptions, 'profilesSampleRate'>;

// Lazy evaluation for testability — env vars may be stubbed per test
const getDSN = () => process.env.NEXT_PUBLIC_SENTRY_DSN ?? '';
const getRelease = () => {
  const commitSha = process.env.COMMIT_SHA?.trim();
  if (commitSha) return commitSha;
  const sentryRelease = process.env.SENTRY_RELEASE?.trim();
  if (sentryRelease) return sentryRelease;
  return 'local';
};
const getEnvironment = () => process.env.NODE_ENV ?? 'development';
const getIsProd = () => (process.env.NODE_ENV ?? 'development') === 'production';

/** Errors to ignore across all runtimes */
const IGNORE_ERRORS: Array<string | RegExp> = [
  'ResizeObserver loop limit exceeded',
  'ResizeObserver loop completed with undelivered notifications',
  /^AbortError/,
  /^NetworkError/,
  'Failed to fetch',
  'Load failed',
  'Network request failed',
];

/**
 * Breadcrumb categories allowed to pass through beforeBreadcrumb.
 * 'sse' is added for SSE stream connect/disconnect/error observability (Wave-14).
 */
const ALLOWED_BREADCRUMB_CATEGORIES = new Set([
  'console',
  'fetch',
  'xhr',
  'navigation',
  'ui',
  'http',
  'sse',
]);

/**
 * Breadcrumb data keys that must NOT be stripped even if they match PII patterns.
 * 'mission_id' is safe — it is a UUID, not a secret.
 */
const BREADCRUMB_DATA_SAFELIST = new Set(['mission_id', 'event_cursor', 'resume_cursor']);

/** Strip sensitive fields from events before send */
function stripPii<T extends { request?: { data?: unknown }; extra?: Record<string, unknown> }>(
  event: T
): T {
  if (event.extra) {
    const sanitized = { ...event.extra };
    for (const key of Object.keys(sanitized)) {
      if (/token|secret|password|key|auth/i.test(key)) {
        sanitized[key] = '[Filtered]';
      }
    }
    event.extra = sanitized;
  }
  return event;
}

/** Filter breadcrumbs: allow only known safe categories; strip PII except safelist keys. */
export function buildBeforeBreadcrumb(
  breadcrumb: { category?: string; data?: Record<string, unknown> },
): typeof breadcrumb | null {
  const category = breadcrumb.category ?? '';
  if (category && !ALLOWED_BREADCRUMB_CATEGORIES.has(category)) return null;

  if (breadcrumb.data) {
    const sanitized = { ...breadcrumb.data };
    for (const key of Object.keys(sanitized)) {
      if (BREADCRUMB_DATA_SAFELIST.has(key)) continue;
      if (/token|secret|password|key|auth/i.test(key)) {
        sanitized[key] = '[Filtered]';
      }
    }
    breadcrumb.data = sanitized;
  }

  return breadcrumb;
}

/** Skip 4xx client errors (not actionable in Sentry) */
function should4xxBeDropped(statusCode: number | undefined): boolean {
  return typeof statusCode === 'number' && statusCode >= 400 && statusCode < 500;
}

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
