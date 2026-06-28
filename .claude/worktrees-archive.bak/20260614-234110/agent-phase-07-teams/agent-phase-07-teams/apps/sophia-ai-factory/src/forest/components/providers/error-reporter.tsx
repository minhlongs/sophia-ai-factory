'use client';

import { useEffect } from 'react';

/**
 * Global client-side error reporter.
 * Captures unhandled JS errors and promise rejections, then sends
 * them to /api/errors/report for server-side structured logging.
 * Renders nothing — side-effects only.
 */
export function ErrorReporter() {
  useEffect(() => {
    function handleError(event: ErrorEvent) {
      fetch('/api/errors/report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: event.message,
          stack: event.error?.stack,
          url: window.location.href,
          userAgent: navigator.userAgent,
          timestamp: new Date().toISOString(),
        }),
      }).catch(() => {});
    }

    function handleRejection(event: PromiseRejectionEvent) {
      fetch('/api/errors/report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: `Unhandled Promise Rejection: ${event.reason}`,
          stack: event.reason?.stack,
          url: window.location.href,
          userAgent: navigator.userAgent,
          timestamp: new Date().toISOString(),
        }),
      }).catch(() => {});
    }

    window.addEventListener('error', handleError);
    window.addEventListener('unhandledrejection', handleRejection);

    return () => {
      window.removeEventListener('error', handleError);
      window.removeEventListener('unhandledrejection', handleRejection);
    };
  }, []);

  return null;
}
