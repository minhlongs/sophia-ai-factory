import React from 'react';
import { cn } from '@/seed/utils/cn';

export interface TableProps<T> {
  /** Table data */
  data: T[];
  /** Table columns definition */
  columns: ColumnDef<T>[];
  /** Row key extractor */
  getRowId?: (row: T, index: number) => string | number;
  /** Empty state message */
  emptyMessage?: string;
  /** Loading state */
  loading?: boolean;
  /** Row click handler */
  onRowClick?: (row: T) => void;
  /** Table className */
  className?: string;
}

export interface ColumnDef<T> {
  /** Column key */
  key: string;
  /** Column header */
  header: React.ReactNode;
  /** Cell renderer */
  cell: (row: T, index: number) => React.ReactNode;
  /** Column width */
  width?: string;
  /** Alignment */
  align?: 'left' | 'center' | 'right';
}

/**
 * Stitch-compatible Table component
 *
 * Material Design 3 data table with Sophia theme.
 */
export function Table<T>({
  data,
  columns,
  getRowId = (_, index) => index,
  emptyMessage = 'No data available',
  loading = false,
  onRowClick,
  className = '',
}: TableProps<T>) {
  return (
    <div className={cn('bg-surface-container-lowest rounded-xl border border-outline-variant custom-shadow-md overflow-hidden', className)}>
      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead>
            <tr className="bg-surface-container text-on-surface-variant font-label-sm">
              {columns.map((col, idx) => (
                <th
                  key={idx}
                  className={cn(
                    'px-lg py-md font-semibold',
                    col.align === 'center' && 'text-center',
                    col.align === 'right' && 'text-right'
                  )}
                  style={col.width ? { width: col.width } : undefined}
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-outline-variant">
            {loading ? (
              <tr>
                <td colSpan={columns.length} className="px-lg py-xl text-center">
                  <div className="flex items-center justify-center gap-md">
                    <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                    <span className="text-on-surface-variant">Loading...</span>
                  </div>
                </td>
              </tr>
            ) : data.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-lg py-xl text-center text-on-surface-variant">
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              data.map((row, rowIndex) => (
                <tr
                  key={getRowId(row, rowIndex)}
                  className={cn(
                    'hover:bg-background transition-colors group',
                    onRowClick && 'cursor-pointer'
                  )}
                  onClick={() => onRowClick?.(row)}
                >
                  {columns.map((col, colIndex) => (
                    <td
                      key={colIndex}
                      className={cn(
                        'px-lg py-md',
                        col.align === 'center' && 'text-center',
                        col.align === 'right' && 'text-right'
                      )}
                    >
                      {col.cell(row, rowIndex)}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

Table.displayName = 'Table';
