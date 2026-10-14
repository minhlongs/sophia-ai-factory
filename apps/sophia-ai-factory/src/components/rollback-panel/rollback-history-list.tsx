'use client';

import { useTranslations } from 'next-intl';
import { Clock } from 'lucide-react';
import type { RollbackRecord } from './types';

function formatDate(timestamp: number): string {
  return new Date(timestamp * 1000).toLocaleString();
}

interface RollbackHistoryListProps {
  history: RollbackRecord[];
}

export function RollbackHistoryList({ history }: RollbackHistoryListProps) {
  const t = useTranslations('rollback');

  if (history.length === 0) {
    return (
      <div className="text-center text-sm text-amber-100/50">
        {t('noHistory')}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <h4 className="text-sm font-medium text-indigo-300">
        {t('historyTitle')} ({history.length})
      </h4>
      <div className="space-y-2">
        {history.map((record) => (
          <div
            key={record.id}
            className="rounded-md border border-indigo-500/20 bg-indigo-500/5 p-3"
          >
            <div className="flex items-center justify-between text-xs text-indigo-300">
              <div className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {formatDate(record.rolledBackAt)}
              </div>
              <span className="text-indigo-400">
                {record.fromStatus} → {record.toStatus}
              </span>
            </div>
            <p className="mt-1 text-sm text-indigo-100">{record.reason}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
