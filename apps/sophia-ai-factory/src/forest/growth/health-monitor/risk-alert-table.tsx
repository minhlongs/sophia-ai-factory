/**
 * Customer Health & Risk Alert Table
 *
 * Layer: Forest (UI components & presentation)
 * Adheres strictly to the Sophia 4-layer architecture.
 *
 * @module forest/growth/health-monitor/risk-alert-table
 */

import React from 'react';
import { RefreshCw } from 'lucide-react';
import type { CustomerHealthMetrics } from '@/seed/types/retention-types';
import { RiskAlertRow } from './risk-alert-row';
export { RiskAlertRow } from './risk-alert-row';

interface RiskAlertTableProps {
  loading: boolean;
  filteredCustomers: CustomerHealthMetrics[];
  isVi: boolean;
  onOpenIntervention: (cust: CustomerHealthMetrics) => void;
}

export function RiskAlertTable({
  loading,
  filteredCustomers,
  isVi,
  onOpenIntervention,
}: RiskAlertTableProps) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 overflow-hidden shadow-sm">
      {loading ? (
        <div className="p-12 text-center text-zinc-500 text-xs">
          <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-zinc-400" />
          {isVi
            ? 'Đang phân tích telemetry khách hàng...'
            : 'Analyzing telemetry health metrics...'}
        </div>
      ) : filteredCustomers.length === 0 ? (
        <div className="p-12 text-center text-zinc-500 text-xs">
          {isVi
            ? 'Không có khách hàng nào trong nhóm lọc này'
            : 'No customers match the selected filter'}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-zinc-900/80 border-b border-zinc-800 text-zinc-400 uppercase tracking-wider text-[10px]">
              <tr>
                <th className="py-3 px-4">{isVi ? 'Khách hàng' : 'Customer'}</th>
                <th className="py-3 px-4">{isVi ? 'Điểm Sức khỏe' : 'Health Score'}</th>
                <th className="py-3 px-4">{isVi ? 'Chi tiết 4 Yếu tố' : '4-Factor Breakdown'}</th>
                <th className="py-3 px-4">{isVi ? 'Trạng thái' : 'Status'}</th>
                <th className="py-3 px-4 text-right">{isVi ? 'Can thiệp Founder' : 'Action'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/60">
              {filteredCustomers.map((cust) => (
                <RiskAlertRow
                  key={cust.userId}
                  cust={cust}
                  isVi={isVi}
                  onOpenIntervention={onOpenIntervention}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
