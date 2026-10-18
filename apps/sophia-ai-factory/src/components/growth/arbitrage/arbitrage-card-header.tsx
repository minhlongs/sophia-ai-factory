'use client';

/**
 * Arbitrage Card Header with Action Controls and Feedback Banner
 *
 * @module components/growth/arbitrage/arbitrage-card-header
 */

import React from 'react';
import type { DictType } from './types';

export interface ArbitrageCardHeaderProps {
  dict: DictType;
  isRecalibrating: boolean;
  isExecuting: boolean;
  feedback: string | null;
  onRecalibrate: () => void;
  onExecute: () => void;
}

export function ArbitrageCardHeader({
  dict,
  isRecalibrating,
  isExecuting,
  feedback,
  onRecalibrate,
  onExecute,
}: ArbitrageCardHeaderProps) {
  return (
    <>
      <header className="flex flex-col sm:flex-row sm:items-center justify-between pb-6 border-b border-gray-200 gap-4">
        <div>
          <div className="flex items-center space-x-3">
            <span className="px-2.5 py-1 text-xs font-semibold uppercase tracking-wider bg-amber-100 text-amber-800 rounded-full border border-amber-300">
              {dict.badge}
            </span>
            <span className="text-xs text-gray-500">{dict.liveOptimization}</span>
          </div>
          <h1 className="text-2xl font-bold mt-1 text-gray-900">{dict.title}</h1>
          <p className="text-sm text-gray-600 mt-0.5">{dict.subtitle}</p>
        </div>
        <div className="flex items-center space-x-3">
          <button
            type="button"
            onClick={onRecalibrate}
            disabled={isRecalibrating || isExecuting}
            className="px-4 py-2 text-sm font-medium border border-gray-300 bg-white hover:bg-gray-50 rounded-lg shadow-sm transition-colors cursor-pointer disabled:opacity-50"
          >
            {isRecalibrating ? dict.recalibrating : dict.recalibrateAll}
          </button>
          <button
            type="button"
            onClick={onExecute}
            disabled={isExecuting || isRecalibrating}
            className="px-4 py-2 text-sm font-medium text-white bg-[#CA7F16] hover:bg-[#CC8C33] rounded-lg shadow-sm transition-colors cursor-pointer disabled:opacity-50"
          >
            {isExecuting ? dict.executing : dict.executeArbitrage}
          </button>
        </div>
      </header>

      {feedback && (
        <div className="p-3 text-sm bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg">
          {feedback}
        </div>
      )}
    </>
  );
}
