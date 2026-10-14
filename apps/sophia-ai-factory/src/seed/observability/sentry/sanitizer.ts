/**
 * Sentry Breadcrumb & Event Sanitizer
 *
 * Layer: seed/observability/sentry
 */

import type { Breadcrumb } from '@sentry/core';
import {
  ALLOWED_BREADCRUMB_CATEGORIES,
  BREADCRUMB_DATA_SAFELIST,
} from './constants';
import { shouldKeepSseBreadcrumb } from './sse-sampler';

/** Strip sensitive fields from events before send */
export function stripPii<T extends { request?: { data?: unknown }; extra?: Record<string, unknown> }>(
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
export function should4xxBeDropped(statusCode: number | undefined): boolean {
  return typeof statusCode === 'number' && statusCode >= 400 && statusCode < 500;
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

export function tagCronRoute<T extends { request?: { url?: string }; tags?: Record<string, unknown> }>(
  event: T,
): T {
  const url = event.request?.url ?? '';
  const match = CRON_ROUTE_RE.exec(url);
  if (match) {
    event.tags = { ...event.tags, cron_route: match[1] };
  }
  return event;
}
