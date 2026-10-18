/**
 * Viral Funnel Performance Table
 *
 * Layer: Forest (UI components & coordinators)
 * Adheres strictly to the Sophia 4-layer architecture.
 *
 * @module forest/growth/viral-funnel/funnel-table
 */

import React from 'react';
import type { ViralVideoFunnelItem } from '@/seed/types/growth';
import { FunnelTableRow, type FunnelTableRowProps } from './funnel-table-row';

export { FunnelTableRow };
export type { FunnelTableRowProps };

export interface FunnelTableProps {
  items: ViralVideoFunnelItem[];
  isVi: boolean;
  copiedKey: string | null;
  copyToClipboard: (text: string, key: string) => Promise<void>;
}

export function FunnelTable({
  items,
  isVi,
  copiedKey,
  copyToClipboard,
}: FunnelTableProps) {
  return (
    <div className="rounded-xl border border-neutral-800 bg-neutral-900/60 overflow-hidden shadow-xl">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm text-neutral-300">
          <thead className="text-xs uppercase bg-neutral-950/80 text-neutral-400 border-b border-neutral-800">
            <tr>
              <th className="px-4 py-3.5 font-semibold">{isVi ? 'Video & Tiêu Đề' : 'Video & Title'}</th>
              <th className="px-4 py-3.5 font-semibold">{isVi ? 'Lĩnh Vực' : 'Niche'}</th>
              <th className="px-4 py-3.5 font-semibold">{isVi ? 'Nền Tảng' : 'Platform'}</th>
              <th className="px-4 py-3.5 font-semibold">{isVi ? 'Loại Hook' : 'Hook Type'}</th>
              <th className="px-4 py-3.5 font-semibold text-right">{isVi ? 'Lượt Xem' : 'Views'}</th>
              <th className="px-4 py-3.5 font-semibold text-right">{isVi ? 'Clicks CTA' : 'Clicks'}</th>
              <th className="px-4 py-3.5 font-semibold text-right">{isVi ? 'Tỷ Lệ CTR' : 'CTR %'}</th>
              <th className="px-4 py-3.5 font-semibold text-right">{isVi ? 'Leads' : 'Leads'}</th>
              <th className="px-4 py-3.5 font-semibold text-center">{isVi ? 'Trạng Thái' : 'Status'}</th>
              <th className="px-4 py-3.5 font-semibold text-center">{isVi ? 'Hành Động' : 'Actions'}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-800/60">
            {items.length === 0 ? (
              <tr>
                <td colSpan={10} className="px-4 py-8 text-center text-neutral-500">
                  {isVi ? 'Không tìm thấy video nào phù hợp.' : 'No videos found matching filters.'}
                </td>
              </tr>
            ) : (
              items.map((item) => (
                <FunnelTableRow
                  key={item.videoId}
                  item={item}
                  isVi={isVi}
                  copiedKey={copiedKey}
                  copyToClipboard={copyToClipboard}
                />
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
