/**
 * Sentry Configuration Constants and Environment Helpers
 *
 * Layer: seed/observability/sentry
 */

import type { NodeOptions } from '@sentry/nextjs';

// EdgeOptions not exported by @sentry/nextjs; edge subset is compatible with NodeOptions
export type EdgeOptions = Omit<NodeOptions, 'profilesSampleRate'>;

// Lazy evaluation for testability — env vars may be stubbed per test
export const getDSN = (): string => process.env.NEXT_PUBLIC_SENTRY_DSN ?? '';

export const getRelease = (): string => {
  const commitSha = process.env.COMMIT_SHA?.trim();
  if (commitSha) return commitSha;
  const sentryRelease = process.env.SENTRY_RELEASE?.trim();
  if (sentryRelease) return sentryRelease;
  return 'local';
};

export const getEnvironment = (): string => process.env.NODE_ENV ?? 'development';

export const getIsProd = (): boolean => (process.env.NODE_ENV ?? 'development') === 'production';

/** Errors to ignore across all runtimes */
export const IGNORE_ERRORS: Array<string | RegExp> = [
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
export const ALLOWED_BREADCRUMB_CATEGORIES = new Set([
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
export const BREADCRUMB_DATA_SAFELIST = new Set(['mission_id', 'event_cursor', 'resume_cursor']);
