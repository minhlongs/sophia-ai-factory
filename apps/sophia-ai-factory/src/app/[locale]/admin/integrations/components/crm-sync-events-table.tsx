import React from 'react';
import type { CrmSyncEvent } from '@/tree/integrations/types';

interface CrmSyncEventsTableProps {
  isVi: boolean;
  syncEvents: CrmSyncEvent[];
}

export function CrmSyncEventsTable({ isVi, syncEvents }: CrmSyncEventsTableProps) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-6 backdrop-blur-sm">
      <h3 className="text-base font-semibold text-white">
        {isVi ? 'Lịch Sử Sự Kiện Đồng Bộ CRM' : 'Recent CRM Sync Events'}
      </h3>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-left text-xs text-zinc-300">
          <thead className="border-b border-zinc-800 text-zinc-400">
            <tr>
              <th className="pb-2.5 font-medium">{isVi ? 'Mã Sự Kiện' : 'Event ID'}</th>
              <th className="pb-2.5 font-medium">{isVi ? 'Thực Thể' : 'Entity'}</th>
              <th className="pb-2.5 font-medium">{isVi ? 'Hướng' : 'Direction'}</th>
              <th className="pb-2.5 font-medium">{isVi ? 'Trạng Thái' : 'Status'}</th>
              <th className="pb-2.5 font-medium">{isVi ? 'Thời Gian' : 'Timestamp'}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800/60">
            {syncEvents.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-4 text-center text-zinc-500">
                  {isVi ? 'Chưa có sự kiện đồng bộ nào' : 'No sync events recorded yet'}
                </td>
              </tr>
            ) : (
              syncEvents.map((evt) => (
                <tr key={evt.id} className="hover:bg-zinc-800/30">
                  <td className="py-2.5 font-mono text-zinc-400 truncate max-w-[120px]">
                    {evt.id}
                  </td>
                  <td className="py-2.5">
                    <span className="capitalize">{evt.entityType}</span>:{' '}
                    <span className="font-mono text-zinc-400">{evt.entityId}</span>
                  </td>
                  <td className="py-2.5 uppercase font-mono text-xs">{evt.direction}</td>
                  <td className="py-2.5">
                    <span
                      className={`rounded-full px-2 py-0.5 text-[11px] font-semibold border ${
                        evt.status === 'synced'
                          ? 'border-emerald-800 bg-emerald-950/60 text-emerald-400'
                          : evt.status === 'ignored'
                          ? 'border-purple-800 bg-purple-950/60 text-purple-400'
                          : evt.status === 'pending'
                          ? 'border-amber-800 bg-amber-950/60 text-amber-400'
                          : 'border-red-800 bg-red-950/60 text-red-400'
                      }`}
                    >
                      {evt.status === 'ignored' ? (
                        isVi ? 'Đã Chặn (Bảo Vệ Quyền Uy)' : 'Ignored (Authority Guard)'
                      ) : (
                        evt.status
                      )}
                    </span>
                  </td>
                  <td className="py-2.5 text-zinc-400">
                    {new Date(evt.createdAt).toLocaleString(isVi ? 'vi-VN' : 'en-US')}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
