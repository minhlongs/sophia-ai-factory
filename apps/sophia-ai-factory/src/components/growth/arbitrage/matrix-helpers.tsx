'use client';

/**
 * Arbitrage Matrix Table Helpers
 *
 * @module components/growth/arbitrage/matrix-helpers
 */

import React from 'react';
import type { DictType } from './types';

export function getPlatformDot(platform: string): React.ReactNode {
  const normalized = platform.toUpperCase();
  if (normalized.includes('TIKTOK')) {
    return <span className="w-2.5 h-2.5 rounded-full bg-black inline-block" aria-hidden="true" />;
  }
  if (normalized.includes('YOUTUBE') || normalized.includes('SHORTS')) {
    return <span className="w-2.5 h-2.5 rounded-full bg-red-600 inline-block" aria-hidden="true" />;
  }
  return <span className="w-2.5 h-2.5 rounded-full bg-pink-500 inline-block" aria-hidden="true" />;
}

export function getScoreColor(platform: string): string {
  const normalized = platform.toUpperCase();
  if (normalized.includes('TIKTOK')) return 'text-[#CA7F16]';
  if (normalized.includes('YOUTUBE') || normalized.includes('SHORTS')) return 'text-red-600';
  return 'text-pink-600';
}

export function getStatusBadge(status: string, dict: DictType): React.ReactNode {
  const upper = status.toUpperCase();
  if (upper === 'OPTIMIZED' || upper === 'ĐÃ TỐI ƯU') {
    return (
      <span className="px-2 py-0.5 text-xs font-medium bg-green-100 text-green-800 rounded">
        {dict.statusOptimized}
      </span>
    );
  }
  if (upper === 'QUEUED' || upper === 'ĐANG CHỜ') {
    return (
      <span className="px-2 py-0.5 text-xs font-medium bg-blue-100 text-blue-800 rounded">
        {dict.statusQueued}
      </span>
    );
  }
  return (
    <span className="px-2 py-0.5 text-xs font-medium bg-amber-100 text-amber-800 rounded">
      {dict.statusPending}
    </span>
  );
}
