'use client';

import React from 'react';
import type { PartnerDashboardData } from '@/tree/partners/types';

interface TabCommissionsProps {
  recentCommissions: PartnerDashboardData['recentCommissions'];
  locale: string;
  isVi: boolean;
}

export function TabCommissions({
  recentCommissions,
  locale,
  isVi,
}: TabCommissionsProps) {
  return (
    <div className="rounded-2xl bg-zinc-900/60 border border-zinc-800 overflow-hidden">
      <div className="p-5 border-b border-zinc-800">
        <h3 className="text-base font-bold text-zinc-100">
          {isVi ? 'Lịch Sử Giao Dịch & Hoa Hồng' : 'Attributed Commissions Ledger'}
        </h3>
      </div>

      {recentCommissions && recentCommissions.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-zinc-950/80 text-zinc-400 uppercase font-semibold border-b border-zinc-800">
              <tr>
                <th className="p-4">Order ID</th>
                <th className="p-4">{isVi ? 'Ngày' : 'Date'}</th>
                <th className="p-4">MRR</th>
                <th className="p-4">{isVi ? 'Tỷ Lệ' : 'Rate'}</th>
                <th className="p-4">{isVi ? 'Hoa Hồng' : 'Commission'}</th>
                <th className="p-4">Tier</th>
                <th className="p-4">{isVi ? 'Trạng Thái' : 'Status'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/60">
              {recentCommissions.map((comm) => (
                <tr key={comm.id} className="hover:bg-zinc-800/20">
                  <td className="p-4 font-mono text-zinc-300">{comm.order_id}</td>
                  <td className="p-4 text-zinc-400">
                    {new Date(comm.created_at).toLocaleDateString(
                      locale === 'vi' ? 'vi-VN' : 'en-US'
                    )}
                  </td>
                  <td className="p-4 font-semibold text-zinc-200">
                    ${(comm.mrr_cents / 100).toFixed(2)}
                  </td>
                  <td className="p-4 text-zinc-300">{comm.commission_rate_pct}%</td>
                  <td className="p-4 font-bold text-cyan-400">
                    ${(comm.commission_cents / 100).toFixed(2)}
                  </td>
                  <td className="p-4">
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-zinc-800 text-zinc-300">
                      {comm.tier_at_time}
                    </span>
                  </td>
                  <td className="p-4">
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                        comm.status === 'paid'
                          ? 'bg-emerald-500/20 text-emerald-400'
                          : comm.status === 'approved'
                          ? 'bg-blue-500/20 text-blue-400'
                          : 'bg-amber-500/20 text-amber-400'
                      }`}
                    >
                      {comm.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="p-8 text-center text-zinc-500 text-sm">
          {isVi ? 'Chưa có hoa hồng nào được ghi nhận.' : 'No commission records found yet.'}
        </div>
      )}
    </div>
  );
}
