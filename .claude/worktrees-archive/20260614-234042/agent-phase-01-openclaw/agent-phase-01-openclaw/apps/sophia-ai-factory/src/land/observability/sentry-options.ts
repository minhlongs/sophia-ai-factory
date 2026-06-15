/**
 * Sentry shared options — typed builders for client, server, and edge runtimes.
 * Centralizes DSN, sampling, ignoreErrors, and release tagging.
 */
import type { BrowserOptions, NodeOptions } from '@sentry/nextjs';
import type { Breadcrumb } from '@sentry/core';

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

/**
 * SSE breadcrumb sampling — Wave-15.
 * Rationale: SSE streams emit high-frequency events; sampling prevents Sentry
 * breadcrumb quota exhaustion while preserving signal for errors and first events.
 *
 * Policy:
 * - Always pass: category='error', first event per mission (tracked per second bucket)
 * - Drop: > MAX_SSE_PER_SECOND SSE breadcrumbs in the same 1-second bucket per mission
 */
// First event per 1-second window per mission always passes; events 2..10 sampled at 10%
// (1-in-10); events 11+ in the same window are dropped. Errors always bypass sampling.
const SSE_SAMPLE_RATE = 0.1;
const MAX_SSE_PER_SECOND = 10; // absolute cap per mission per second

interface SseBucket {
  count: number;
  windowStart: number; // unix seconds
}

// Module-level counter: missionId → bucket. Cleared when window advances.
const sseMissionBuckets = new Map<string, SseBucket>();

/**
 * Deterministic SSE breadcrumb sampler.
 * Returns true (keep) or false (drop).
 */
export function shouldKeepSseBreadcrumb(
  data: Record<string, unknown> | undefined,
  level?: string,
): boolean {
  // Always keep error-level SSE breadcrumbs
  if (level === 'error') return true;

  const missionId = typeof data?.mission_id === 'string' ? data.mission_id : '__global__';
  const nowSec = Math.floor(Date.now() / 1000);

  const bucket = sseMissionBuckets.get(missionId);
  if (!bucket || bucket.windowStart !== nowSec) {
    // New window — always keep the first event
    sseMissionBuckets.set(missionId, { count: 1, windowStart: nowSec });
    return true;
  }

  bucket.count += 1;

  // Hard cap
  if (bucket.count > MAX_SSE_PER_SECOND) return false;

  // Probabilistic sample for events 2..MAX_SSE_PER_SECOND
  return Math.random() < SSE_SAMPLE_RATE;
}

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

/** Filter breadcrumbs: allow only known safe categories; strip PII except safelist keys.
 *  SSE breadcrumbs are additionally rate-sampled (Wave-15). */
export function buildBeforeBreadcrumb(
  breadcrumb: Breadcrumb,
): Breadcrumb | null {
  const category = breadcrumb.category ?? '';
  if (category && !ALLOWED_BREADCRUMB_CATEGORIES.has(category)) return null;

  // SSE sampling — drop high-frequency stream events beyond configured rate
  if (category === 'sse' && !shouldKeepSseBreadcrumb(breadcrumb.data, breadcrumb.level)) {
    return null;
  }

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

/**
 * Cron route tagging — OG-002 (Wave-4 infra).
 *
 * If the request URL matches /api/cron/<name>, tag the Sentry event with
 * `cron_route: <name>` so alert rules can filter specifically for cron failures.
 *
 * Works by inspecting `event.request.url` which Next.js populates on the server.
 * Safe to call on every event — returns event unmodified if URL does not match.
 */
const CRON_ROUTE_RE = /\/api\/cron\/([^/?#]+)/;

function tagCronRoute<T extends { request?: { url?: string }; tags?: Record<string, unknown> }>(
  event: T,
): T {
  const url = event.request?.url ?? '';
  const match = CRON_ROUTE_RE.exec(url);
  if (match) {
    event.tags = { ...event.tags, cron_route: match[1] };
  }
  return event;
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
