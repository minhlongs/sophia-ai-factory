'use client';

/**
 * Arbitrage KPI Row Component
 *
 * @module components/growth/arbitrage/arbitrage-kpi-row
 */

import React from 'react';
import type { DictType } from './types';

export interface ArbitrageKpiRowProps {
  dict: DictType;
  reachLift: number;
  reachLiftComparison: string;
  computeSavings: number;
  computeSavingsNote: string;
  hookDivergence: number;
  divergenceNote: string;
  shadowbanRate: number;
  shadowbanNote: string;
}

export function ArbitrageKpiRow({
  dict,
  reachLift,
  reachLiftComparison,
  computeSavings,
  computeSavingsNote,
  hookDivergence,
  divergenceNote,
  shadowbanRate,
  shadowbanNote,
}: ArbitrageKpiRowProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
      <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{dict.reachLift}</p>
        <p className="text-3xl font-extrabold text-[#CA7F16] mt-1">
          {reachLift > 0 ? `+${reachLift.toFixed(1)}%` : `${reachLift.toFixed(1)}%`}
        </p>
        <p className="text-xs text-green-600 mt-1 flex items-center">{reachLiftComparison}</p>
      </div>

      <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{dict.computeSavings}</p>
        <p className="text-3xl font-extrabold text-gray-900 mt-1">${computeSavings.toFixed(2)}</p>
        <p className="text-xs text-gray-500 mt-1">{computeSavingsNote}</p>
      </div>

      <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{dict.hookDivergence}</p>
        <p className="text-3xl font-extrabold text-indigo-600 mt-1">{hookDivergence.toFixed(3)} JSD</p>
        <p className="text-xs text-gray-500 mt-1">{divergenceNote}</p>
      </div>

      <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{dict.shadowbanAvoidance}</p>
        <p className="text-3xl font-extrabold text-emerald-600 mt-1">{shadowbanRate.toFixed(1)}%</p>
        <p className="text-xs text-gray-500 mt-1">{shadowbanNote}</p>
      </div>
    </div>
  );
}
