'use client';

/**
 * StatusLog — client component that displays recent rotation audit events.
 *
 * Receives data as props from the server component.
 * Columns: Timestamp, Action, Details.
 * Shows empty state when no rotation events exist.
 *
 * @module app/[locale]/dashboard/admin/byok-rotation/components/status-log
 */

import { History } from 'lucide-react';
import type { RotationEventDto } from '../page';

interface StatusLogProps {
  events: RotationEventDto[];
  isVi: boolean;
}

function formatTimestamp(unixSec: number): string {
  try {
    const d = new Date(unixSec * 1000);
    if (isNaN(d.getTime())) return String(unixSec);
    return d.toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  } catch {
    return String(unixSec);
  }
}

/** Human-readable action label. Keys come from logAuditEvent (uppercased). */
function actionLabel(action: string, isVi: boolean): string {
  const upper = action.toUpperCase();
  if (upper === 'KEY_ROTATION.REQUESTED') {
    return isVi ? 'Yêu cầu Rotation' : 'Rotation Requested';
  }
  if (upper === 'KEY_ROTATION.REENCRYPT_START') {
    return isVi ? 'Bắt đầu Mã hóa Lại' : 'Re-encrypt Started';
  }
  if (upper === 'KEY_ROTATION.REENCRYPT_COMPLETE') {
    return isVi ? 'Hoàn tất Mã hóa Lại' : 'Re-encrypt Complete';
  }
  if (upper === 'KEY_ROTATION.CRON_TRIGGERED') {
    return isVi ? 'Cron Kích hoạt' : 'Cron Triggered';
  }
  if (upper === 'KEY_ROTATION.CRON_SKIP_NO_VERSION') {
    return isVi ? 'Bỏ qua (Không có phiên bản)' : 'Skipped (No version)';
  }
  if (upper === 'KEY_ROTATION.CRON_SKIP_TOO_YOUNG') {
    return isVi ? 'Bỏ qua (Chưa đến hạn)' : 'Skipped (Too early)';
  }
  // Fallback: strip prefix and show readable form
  const clean = action.replace(/^KEY_ROTATION\./i, '').replace(/_/g, ' ');
  return clean.charAt(0).toUpperCase() + clean.slice(1).toLowerCase();
}

function detailsSummary(details: Record<string, unknown> | null): string {
  if (!details) return '';
  const parts: string[] = [];
  if (details.keyVersion) parts.push(`v${details.keyVersion}`);
  if (details.oldVersion) parts.push(`from v${details.oldVersion}`);
  if (details.reason) parts.push(String(details.reason));
  return parts.join(' | ');
}

export default function StatusLog({ events, isVi }: StatusLogProps) {
  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2">
        <History className="w-5 h-5 text-muted-foreground" aria-hidden="true" />
        <h2 className="text-lg font-semibold">
          {isVi ? 'Lịch Sử Rotation' : 'Rotation History'}
        </h2>
        {events.length > 0 && (
          <span className="text-xs text-muted-foreground">
            ({events.length} {isVi ? 'sự kiện' : 'events'})
          </span>
        )}
      </div>

      {events.length === 0 ? (
        <div className="rounded-lg border border-border bg-card p-8 text-center">
          <History className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" aria-hidden="true" />
          <p className="text-sm text-muted-foreground">
            {isVi
              ? 'Chưa có sự kiện rotation nào.'
              : 'No rotation events yet.'}
          </p>
          <p className="text-xs text-muted-foreground/60 mt-1">
            {isVi
              ? 'Các sự kiện rotation sẽ xuất hiện ở đây sau khi bạn thực hiện rotation lần đầu.'
              : 'Rotation events will appear here after you perform the first rotation.'}
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border bg-card">
          <table className="w-full text-sm">
            <caption className="sr-only">
              {isVi ? 'Danh sách sự kiện rotation' : 'Rotation event list'}
            </caption>
            <thead className="bg-muted/40 text-left text-muted-foreground">
              <tr>
                <th scope="col" className="px-4 py-3 font-medium">
                  {isVi ? 'Thời Gian' : 'Timestamp'}
                </th>
                <th scope="col" className="px-4 py-3 font-medium">
                  {isVi ? 'Hành Động' : 'Action'}
                </th>
                <th scope="col" className="px-4 py-3 font-medium">
                  {isVi ? 'Chi Tiết' : 'Details'}
                </th>
              </tr>
            </thead>
            <tbody>
              {events.map((e) => (
                <tr key={e.id} className="border-t border-border align-top">
                  <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                    {formatTimestamp(e.createdAt)}
                  </td>
                  <td className="px-4 py-3">
                    <span className="font-mono text-xs">
                      {actionLabel(e.action, isVi)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground max-w-md truncate">
                    {detailsSummary(e.details) || '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
