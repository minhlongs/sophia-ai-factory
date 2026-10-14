'use client';

import { useState, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/stitch';
import { Undo2, AlertTriangle } from 'lucide-react';
import { cn } from '@/seed/utils/cn';
import type { RollbackRecord } from './types';

interface RollbackFormProps {
  missionId: string;
  onSuccess: (record: RollbackRecord) => void;
}

export function RollbackForm({ missionId, onSuccess }: RollbackFormProps) {
  const t = useTranslations('rollback');
  const [reason, setReason] = useState('');
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

      const rollbackRecord = data.rollback as RollbackRecord | undefined;
      if (rollbackRecord) {
        onSuccess(rollbackRecord);
      }
    } catch {
      setError(t('rollbackFailed'));
    } finally {
      setIsSubmitting(false);
    }
  }, [missionId, reason, t, onSuccess]);

  return (
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
        <div className="text-sm text-green-400">{t('rollbackSuccess')}</div>
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
  );
}
