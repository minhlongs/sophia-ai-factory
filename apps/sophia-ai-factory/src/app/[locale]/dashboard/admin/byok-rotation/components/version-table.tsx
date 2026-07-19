'use client';

/**
 * VersionTable — client component that displays key version history.
 *
 * Receives data as props from the server component (no client-side fetch).
 * Columns: Version #, Created, Status.
 * Highlights the currently active version with a badge.
 * Shows empty state when no versions exist.
 *
 * @module app/[locale]/dashboard/admin/byok-rotation/components/version-table
 */

import { Database, ShieldCheck } from 'lucide-react';
import type { KeyVersionDto } from '../page';

interface VersionTableProps {
  versions: KeyVersionDto[];
  isVi: boolean;
}

function formatDate(dateStr: string): string {
  try {
    const d = new Date(dateStr.replace(' ', 'T') + 'Z');
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return dateStr;
  }
}

export default function VersionTable({ versions, isVi }: VersionTableProps) {
  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2">
        <Database className="w-5 h-5 text-muted-foreground" aria-hidden="true" />
        <h2 className="text-lg font-semibold">
          {isVi ? 'Lịch Sử Phiên Bản Khóa' : 'Key Version History'}
        </h2>
      </div>

      {versions.length === 0 ? (
        <div className="rounded-lg border border-border bg-card p-8 text-center">
          <Database className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" aria-hidden="true" />
          <p className="text-sm text-muted-foreground">
            {isVi ? 'Chưa có phiên bản khóa nào.' : 'No key versions found.'}
          </p>
          <p className="text-xs text-muted-foreground/60 mt-1">
            {isVi
              ? 'Phiên bản khóa đầu tiên sẽ được tạo khi bạn thực hiện rotation lần đầu.'
              : 'The first key version will be created when you perform the first rotation.'}
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border bg-card">
          <table className="w-full text-sm">
            <caption className="sr-only">
              {isVi ? 'Danh sách phiên bản khóa' : 'Key version list'}
            </caption>
            <thead className="bg-muted/40 text-left text-muted-foreground">
              <tr>
                <th scope="col" className="px-4 py-3 font-medium">
                  {isVi ? 'Phiên Bản' : 'Version'}
                </th>
                <th scope="col" className="px-4 py-3 font-medium">
                  {isVi ? 'Ngày Tạo' : 'Created'}
                </th>
                <th scope="col" className="px-4 py-3 font-medium">
                  {isVi ? 'Trạng Thái' : 'Status'}
                </th>
              </tr>
            </thead>
            <tbody>
              {versions.map((v) => (
                <tr
                  key={v.id}
                  className={`border-t border-border align-middle ${
                    v.isActive ? 'bg-emerald-500/5' : ''
                  }`}
                >
                  <td className="px-4 py-3">
                    <span className="font-mono text-sm font-medium">
                      v{v.version}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {formatDate(v.createdAt)}
                  </td>
                  <td className="px-4 py-3">
                    {v.isActive ? (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-medium text-emerald-300">
                        <ShieldCheck className="w-3.5 h-3.5" aria-hidden="true" />
                        {isVi ? 'Đang Hoạt Động' : 'Active'}
                      </span>
                    ) : (
                      <span className="inline-flex items-center rounded-full bg-muted/60 px-3 py-1 text-xs text-muted-foreground">
                        {isVi ? 'Đã Nghỉ Hưu' : 'Retired'}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="border-t border-border px-4 py-2 text-xs text-muted-foreground/60">
            {isVi
              ? `Hiển thị ${versions.length} phiên bản gần đây nhất`
              : `Showing ${versions.length} most recent versions`}
          </div>
        </div>
      )}
    </section>
  );
}
