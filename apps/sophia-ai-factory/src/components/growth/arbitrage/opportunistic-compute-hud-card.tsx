'use client';

/**
 * Opportunistic Compute HUD Card Component
 *
 * @module components/growth/arbitrage/opportunistic-compute-hud-card
 */

import React from 'react';
import type { DictType } from './types';

export interface OpportunisticComputeHudCardProps {
  dict: DictType;
  regimeBadge: string;
  regimeDesc: string;
  heygenDispatched: number;
  heygenCapacity: number;
  didDispatched: number;
  didCapacity: number;
  circuitBreakerStatus: string;
}

export function OpportunisticComputeHudCard({
  dict,
  regimeBadge,
  regimeDesc,
  heygenDispatched,
  heygenCapacity,
  didDispatched,
  didCapacity,
  circuitBreakerStatus,
}: OpportunisticComputeHudCardProps) {
  return (
    <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm space-y-4">
      <h2 className="text-base font-bold text-gray-900">{dict.computeTitle}</h2>

      <div className="p-4 bg-amber-50 rounded-lg border border-amber-200">
        <div className="flex items-center justify-between text-xs text-amber-900 font-semibold mb-1">
          <span>{dict.computeRegime}</span>
          <span className="px-2 py-0.5 bg-amber-200 text-amber-900 rounded font-bold">
            {regimeBadge}
          </span>
        </div>
        <p className="text-xs text-amber-800 leading-relaxed">{regimeDesc}</p>
      </div>

      <div className="space-y-3 pt-2">
        <div>
          <div className="flex justify-between items-center text-xs mb-1">
            <span className="text-gray-600">{dict.heygenLabel}</span>
            <span className="font-bold font-mono text-gray-900">
              {heygenDispatched} {dict.heygenDispatchedSuffix}
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-1.5 overflow-hidden">
            <div
              className="bg-[#CA7F16] h-1.5 rounded-full transition-all duration-300"
              style={{ width: `${heygenCapacity}%` }}
              role="progressbar"
              aria-valuenow={heygenCapacity}
              aria-valuemin={0}
              aria-valuemax={100}
            />
          </div>
        </div>

        <div>
          <div className="flex justify-between items-center text-xs mb-1">
            <span className="text-gray-600">{dict.didLabel}</span>
            <span className="font-bold font-mono text-gray-900">
              {didDispatched} {dict.didDispatchedSuffix}
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-1.5 overflow-hidden">
            <div
              className="bg-indigo-600 h-1.5 rounded-full transition-all duration-300"
              style={{ width: `${didCapacity}%` }}
              role="progressbar"
              aria-valuenow={didCapacity}
              aria-valuemin={0}
              aria-valuemax={100}
            />
          </div>
        </div>

        <div className="flex justify-between items-center text-xs pt-1 border-t border-gray-100">
          <span className="text-gray-600">{dict.circuitBreaker}</span>
          <span className="text-emerald-600 font-bold tracking-tight">
            {circuitBreakerStatus}
          </span>
        </div>
      </div>
    </div>
  );
}
