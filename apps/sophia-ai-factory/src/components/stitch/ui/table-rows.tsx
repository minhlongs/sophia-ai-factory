/**
 * Table row and body rendering helpers for Stitch Table.
 * Layer: components/stitch/ui
 * @module components/stitch/ui/table-rows
 */

import React from 'react';
import { cn } from '@/seed/utils/cn';
import type { ColumnDef } from './table';

interface TableBodyProps<T> {
  data: T[];
  columns: ColumnDef<T>[];
  getRowId: (row: T, index: number) => string | number;
  emptyMessage: string;
  loading: boolean;
  onRowClick?: (row: T) => void;
  stickyFirstColumn: boolean;
}

export function TableBody<T>({
  data,
  columns,
  getRowId,
  emptyMessage,
  loading,
  onRowClick,
  stickyFirstColumn,
}: TableBodyProps<T>) {
  if (loading) {
    return (
      <tbody className="divide-y divide-border dark:divide-white/[0.06] text-sm">
        <tr>
          <td colSpan={columns.length} className="px-3 sm:px-6 py-12 text-center">
            <div className="flex items-center justify-center gap-3">
              <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              <span className="text-muted-foreground">Loading...</span>
            </div>
          </td>
        </tr>
      </tbody>
    );
  }

  if (data.length === 0) {
    return (
      <tbody className="divide-y divide-border dark:divide-white/[0.06] text-sm">
        <tr>
          <td colSpan={columns.length} className="px-3 sm:px-6 py-12 text-center text-muted-foreground">
            {emptyMessage}
          </td>
        </tr>
      </tbody>
    );
  }

  return (
    <tbody className="divide-y divide-border dark:divide-white/[0.06] text-sm">
      {data.map((row, rowIndex) => (
        <tr
          key={getRowId(row, rowIndex)}
          className={cn(
            'hover:bg-black/[0.02] dark:hover:bg-white/[0.02] transition-colors',
            onRowClick && 'cursor-pointer'
          )}
          onClick={() => onRowClick?.(row)}
        >
          {columns.map((col, colIndex) => (
            <td
              key={colIndex}
              className={cn(
                'px-3 sm:px-6 py-4 text-foreground dark:text-slate-200',
                col.align === 'center' && 'text-center',
                col.align === 'right' && 'text-right',
                stickyFirstColumn && colIndex === 0 && 'sticky left-0 bg-card dark:bg-[#11131F] z-10 shadow-[1px_0_0_rgba(0,0,0,0.08)] dark:shadow-[1px_0_0_rgba(255,255,255,0.08)]'
              )}
            >
              {col.cell(row, rowIndex)}
            </td>
          ))}
        </tr>
      ))}
    </tbody>
  );
}