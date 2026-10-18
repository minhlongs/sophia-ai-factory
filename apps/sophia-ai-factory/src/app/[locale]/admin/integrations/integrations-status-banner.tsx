'use client';

/**
 * Integrations Portal Status Banner
 *
 * Layer: land (Admin UI Client Sub-component)
 */

import React from 'react';
import { CheckCircle2, AlertCircle } from 'lucide-react';

export interface IntegrationsStatusBannerProps {
  statusMessage: { type: 'success' | 'error'; text: string } | null;
}

export function IntegrationsStatusBanner({ statusMessage }: IntegrationsStatusBannerProps) {
  if (!statusMessage) return null;

  const isSuccess = statusMessage.type === 'success';
  return (
    <div
      className={`flex items-center gap-2 rounded-lg p-3 text-sm border ${
        isSuccess
          ? 'bg-emerald-950/50 border-emerald-800 text-emerald-200'
          : 'bg-red-950/50 border-red-800 text-red-200'
      }`}
    >
      {isSuccess ? (
        <CheckCircle2 className="h-4 w-4 text-emerald-400" />
      ) : (
        <AlertCircle className="h-4 w-4 text-red-400" />
      )}
      <span>{statusMessage.text}</span>
    </div>
  );
}
