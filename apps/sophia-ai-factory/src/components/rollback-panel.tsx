/**
 * RollbackPanel — displays mission status, rollback history, and rollback trigger button.
 * Uses amber/indigo tokens, bilingual via useTranslations.
 *
 * @module components/rollback-panel
 */

'use client';

import { useState, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { Card, CardHeader, CardContent, Button, Badge } from '@/components/stitch';
import { Undo2, Clock, AlertTriangle } from 'lucide-react';
import { cn } from '@/seed/utils/cn';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface RollbackRecord {
  id: string;
  reason: string;
  fromStatus: string;
  toStatus: string;
  triggeredBy: string;
  rolledBackAt: number;
}

interface RollbackPanelProps {
  missionId: string;
  missionStatus: string;
  canRollback: boolean;
  initialHistory: RollbackRecord[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDate(timestamp: number): string {
  return new Date(timestamp * 1000).toLocaleString();
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function RollbackPanel({
  missionId,
  missionStatus,
  canRollback,
  initialHistory,
}: RollbackPanelProps) {
  const t = useTranslations('rollback');
  const [reason, setReason] = useState('');
  const [history, setHistory] = useState<RollbackRecord[]>(initialHistory);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = useCallback(async () => {
    if (reason.trim().length < 5) {
      setError(t('reasonMinLength'));
      return;
    }

    const confirmed = window.confirm(t('confirmMessage'));
    if (!confirmed) return;

    setIsSubmitting(true);
    setError(null);
    setSuccess(false);

    try {
      const response = await fetch('/api/rollback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ missionId, reason: reason.trim() }),
      });

      const data = (await response.json()) as Record<string, unknown>;

      if (!response.ok) {
        setError((data.error as string) ?? t('rollbackFailed'));
        return;
      }

      setSuccess(true);
      setReason('');

      // Add new record to history
      const rollbackRecord = data.rollback as RollbackRecord | undefined;
      if (rollbackRecord) {
        setHistory((prev) => [rollbackRecord, ...prev]);
      }
    } catch {
      setError(t('rollbackFailed'));
    } finally {
      setIsSubmitting(false);
    }
  }, [missionId, reason, t]);

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
        {/* Rollback Form */}
        {canRollback && missionStatus !== 'rolled_back' && (
          <div className="space-y-3">
            <label className="block text-sm font-medium text-amber-200">
              {t('reasonLabel')}
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={t('reasonPlaceholder')}
              rows={3}
              className={cn(
                'w-full rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2',
                'text-sm text-amber-100 placeholder:text-amber-100/50',
                'focus:outline-none focus:ring-2 focus:ring-amber-500/50',
              )}
            />
            {error && (
              <div className="flex items-center gap-2 text-sm text-red-400">
                <AlertTriangle className="h-4 w-4" />
                {error}
              </div>
            )}
            {success && (
              <div className="text-sm text-green-400">
                {t('rollbackSuccess')}
              </div>
            )}
            <Button
              onClick={handleSubmit}
              disabled={isSubmitting || reason.trim().length < 5}
              className="bg-amber-500 text-white hover:bg-amber-600 disabled:opacity-50"
            >
              <Undo2 className="mr-2 h-4 w-4" />
              {isSubmitting ? t('processing') : t('triggerRollback')}
            </Button>
          </div>
        )}

        {missionStatus === 'rolled_back' && (
          <div className="rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-200">
            {t('alreadyRolledBack')}
          </div>
        )}

        {/* Rollback History */}
        {history.length > 0 && (
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
                  <p className="mt-1 text-sm text-indigo-100">
                    {record.reason}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {history.length === 0 && (
          <div className="text-center text-sm text-amber-100/50">
            {t('noHistory')}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
