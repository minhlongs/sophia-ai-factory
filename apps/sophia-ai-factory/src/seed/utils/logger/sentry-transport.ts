import { LogLevel } from './types';

let _sentryModule: {
  captureException: (err: unknown, ctx?: Record<string, unknown>) => unknown;
  addBreadcrumb: (breadcrumb: Parameters<typeof import('@sentry/core').addBreadcrumb>[0]) => void;
} | null = null;
let _sentryLoadAttempted = false;

export async function captureToSentry(
  error: Error,
  metadata?: Record<string, unknown>
): Promise<void> {
  if (_sentryLoadAttempted && !_sentryModule) return;
  try {
    if (!_sentryLoadAttempted) {
      _sentryLoadAttempted = true;
      const sentry = await import('@sentry/nextjs');
      _sentryModule = { captureException: sentry.captureException, addBreadcrumb: sentry.addBreadcrumb };
    }
    _sentryModule?.captureException(error, { extra: metadata });
  } catch {
    _sentryModule = null;
  }
}

export function toSentrySeverity(level: LogLevel): 'debug' | 'info' | 'warning' | 'error' | 'fatal' {
  switch (level) {
    case 'debug': return 'debug';
    case 'info': return 'info';
    case 'warn': return 'warning';
    case 'error': return 'error';
    case 'fatal': return 'fatal';
  }
}

export function addLogBreadcrumbToSentry(
  level: LogLevel,
  message: string,
  metadata?: Record<string, unknown>
): void {
  if (_sentryLoadAttempted && !_sentryModule) return;
  try {
    if (!_sentryLoadAttempted) {
      _sentryLoadAttempted = true;
      import('@sentry/nextjs').then(sentry => {
        _sentryModule = { captureException: sentry.captureException, addBreadcrumb: sentry.addBreadcrumb };
        _sentryModule?.addBreadcrumb({
          message,
          level: toSentrySeverity(level),
          category: 'log',
          data: metadata,
        });
      }).catch(() => {
        _sentryModule = null;
      });
      return;
    }
    _sentryModule?.addBreadcrumb({
      message,
      level: toSentrySeverity(level),
      category: 'log',
      data: metadata,
    });
  } catch {
    // Breadcrumb failures must never affect logging flow
  }
}
