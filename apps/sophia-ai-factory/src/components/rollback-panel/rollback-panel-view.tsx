'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Card, CardHeader, CardContent, Badge } from '@/components/stitch';
import { Undo2 } from 'lucide-react';
import type { RollbackPanelProps, RollbackRecord } from './types';
import { RollbackForm } from './rollback-form';
import { RollbackHistoryList } from './rollback-history-list';

export function RollbackPanel({
  missionId,
  missionStatus,
  canRollback,
  initialHistory,
}: RollbackPanelProps) {
  const t = useTranslations('rollback');
  const [history, setHistory] = useState<RollbackRecord[]>(initialHistory);

  const statusVariant = missionStatus === 'rolled_back' ? 'outline' : 'solid';
  const statusColor =
    missionStatus === 'rolled_back'
      ? 'border-amber-500 text-amber-600'
      : missionStatus === 'failed'
        ? 'border-red-500 text-red-600'
        : 'border-indigo-500 text-indigo-600';

  return (
    <Card className="border border-amber-500/20 bg-amber-500/5">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Undo2 className="h-5 w-5 text-amber-500" />
            <h3 className="text-lg font-semibold text-amber-200">
              {t('panelTitle')}
            </h3>
          </div>
          <Badge variant={statusVariant} className={statusColor}>
            {missionStatus}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {canRollback && missionStatus !== 'rolled_back' && (
          <RollbackForm
            missionId={missionId}
            onSuccess={(record) => setHistory((prev) => [record, ...prev])}
          />
        )}

        {missionStatus === 'rolled_back' && (
          <div className="rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-200">
            {t('alreadyRolledBack')}
          </div>
        )}

        <RollbackHistoryList history={history} />
      </CardContent>
    </Card>
  );
}
