'use client';

/**
 * Platform Matrix Table Component
 *
 * @module components/growth/arbitrage/platform-matrix-table
 */

import React from 'react';
import type { DictType, ArbitragePlatformRow } from './types';
import { getPlatformDot, getScoreColor, getStatusBadge } from './matrix-helpers';

export interface PlatformMatrixTableProps {
  dict: DictType;
  platformMatrix: ArbitragePlatformRow[];
}

export function PlatformMatrixTable({ dict, platformMatrix }: PlatformMatrixTableProps) {
  return (
    <div className="lg:col-span-2 bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-base font-bold text-gray-900">{dict.matrixTitle}</h2>
        <span className="text-xs text-gray-400">{dict.autopilotActive}</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm text-gray-700">
          <thead>
            <tr className="border-b border-gray-200 text-xs text-gray-500 uppercase bg-gray-50">
              <th className="py-3 px-4">{dict.colPlatform}</th>
              <th className="py-3 px-4">{dict.colMetric}</th>
              <th className="py-3 px-4">{dict.colScore}</th>
              <th className="py-3 px-4">{dict.colMutation}</th>
              <th className="py-3 px-4">{dict.colStatus}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {platformMatrix.map((row, idx) => (
              <tr key={`${row.platform}-${idx}`} className="hover:bg-gray-50/50 transition-colors">
                <td className="py-3 px-4 font-semibold flex items-center space-x-2">
                  {getPlatformDot(row.platform)}
                  <span>{row.name}</span>
                </td>
                <td className="py-3 px-4 text-xs text-gray-600">{row.governingMetric}</td>
                <td className={`py-3 px-4 font-mono font-bold ${getScoreColor(row.platform)}`}>
                  {row.calculatedScore.toFixed(3)}
                </td>
                <td className="py-3 px-4 text-xs text-gray-600 max-w-xs truncate" title={row.hookMutation}>
                  {row.hookMutation}
                </td>
                <td className="py-3 px-4">{getStatusBadge(row.status, dict)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
