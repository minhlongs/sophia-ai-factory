import React from 'react';
import type { WebhookDeliveryLog } from '@/tree/integrations/types';

interface DeliveryLogsTableProps {
  isVi: boolean;
  deliveryLogs: WebhookDeliveryLog[];
}

export function DeliveryLogsTable({ isVi, deliveryLogs }: DeliveryLogsTableProps) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-6 backdrop-blur-sm">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold text-white">
          {isVi ? 'Nhật Ký Phân Phối Sự Kiện HMAC-SHA256' : 'Cryptographic Webhook Delivery Logs'}
        </h3>
        <span className="text-xs text-zinc-400">
          {isVi ? 'Tự động kiểm tra Replay Attack (300s)' : 'Enforces 300s Replay Window'}
        </span>
      </div>

      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-left text-xs text-zinc-300">
          <thead className="border-b border-zinc-800 text-zinc-400">
            <tr>
              <th className="pb-2.5 font-medium">{isVi ? 'Mã Lần Gửi' : 'Delivery ID'}</th>
              <th className="pb-2.5 font-medium">{isVi ? 'Sự Kiện' : 'Event'}</th>
              <th className="pb-2.5 font-medium">{isVi ? 'Mã HTTP' : 'HTTP Code'}</th>
              <th className="pb-2.5 font-medium">{isVi ? 'Trạng Thái' : 'Status'}</th>
              <th className="pb-2.5 font-medium">{isVi ? 'Thời Gian (ms)' : 'Latency'}</th>
              <th className="pb-2.5 font-medium">{isVi ? 'Chữ Ký (v1)' : 'Signature (v1)'}</th>
              <th className="pb-2.5 font-medium">{isVi ? 'Lần Thử' : 'Attempt'}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800/60">
            {deliveryLogs.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-6 text-center text-zinc-500">
                  {isVi ? 'Chưa có nhật ký gửi sự kiện nào' : 'No delivery logs recorded yet'}
                </td>
              </tr>
            ) : (
              deliveryLogs.map((log) => (
                <tr key={log.id} className="hover:bg-zinc-800/30">
                  <td className="py-2.5 font-mono text-zinc-400">{log.id}</td>
                  <td className="py-2.5 font-mono text-cyan-300">{log.eventType}</td>
                  <td className="py-2.5 font-mono">
                    {log.httpStatus ? (
                      <span
                        className={
                          log.httpStatus >= 200 && log.httpStatus < 300
                            ? 'text-emerald-400'
                            : 'text-red-400'
                        }
                      >
                        {log.httpStatus}
                      </span>
                    ) : (
                      <span className="text-zinc-500">-</span>
                    )}
                  </td>
                  <td className="py-2.5">
                    <span
                      className={`rounded-full px-2 py-0.5 text-[11px] font-semibold border ${
                        log.status === 'success'
                          ? 'border-emerald-800 bg-emerald-950/60 text-emerald-400'
                          : log.status === 'retrying'
                          ? 'border-amber-800 bg-amber-950/60 text-amber-400'
                          : 'border-red-800 bg-red-950/60 text-red-400'
                      }`}
                    >
                      {log.status}
                    </span>
                  </td>
                  <td className="py-2.5 font-mono text-zinc-400">{log.durationMs || 0}ms</td>
                  <td className="py-2.5 font-mono text-[11px] text-zinc-500 truncate max-w-[140px]">
                    {log.signature}
                  </td>
                  <td className="py-2.5 font-mono text-zinc-300">#{log.attemptNumber} / 5</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
