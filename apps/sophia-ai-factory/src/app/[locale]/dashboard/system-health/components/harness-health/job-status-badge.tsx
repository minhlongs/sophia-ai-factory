'use client';

/**
 * Harness Health Job Status Badge
 * Layer: app/[locale]/dashboard/system-health/components/harness-health
 */

import React from 'react';
import { CheckCircle, AlertCircle, Clock, Loader2 } from 'lucide-react';

export function JobStatusBadge({ status }: { status: string }) {
  switch (status) {
    case 'completed':
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200">
          <CheckCircle className="w-3 h-3" aria-hidden="true" />
          Completed
        </span>
      );
    case 'failed':
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200">
          <AlertCircle className="w-3 h-3" aria-hidden="true" />
          Failed
        </span>
      );
    case 'processing':
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200">
          <Loader2 className="w-3 h-3 motion-safe:animate-spin" aria-hidden="true" />
          Processing
        </span>
      );
    case 'pending':
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-200">
          <Clock className="w-3 h-3" aria-hidden="true" />
          Pending
        </span>
      );
    default:
      return null;
  }
}
