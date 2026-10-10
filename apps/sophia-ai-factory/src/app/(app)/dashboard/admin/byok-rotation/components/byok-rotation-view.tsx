'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { RefreshCw } from 'lucide-react';
import { Button } from '@/seed/components/ui/button';
import { toast } from 'sonner';
import type { ByokRotationClientProps } from './types';
import { CurrentVersionCard } from './current-version-card';
import { VersionHistoryCard } from './version-history-card';
import { AuditLogsCard } from './audit-logs-card';
import { RotationDialog } from './rotation-dialog';

export function ByokRotationView({
  locale,
  currentVersion,
  versionHistory,
  auditLogs,
}: ByokRotationClientProps) {
  const t = useTranslations('admin.keyRotation');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isRotating, setIsRotating] = useState(false);
  const [reason, setReason] = useState('');

  const handleRotate = async () => {
    if (isRotating) return;
    setIsRotating(true);
    try {
      const res = await fetch('/api/admin/keys/rotate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: reason.trim() || undefined }),
      });
      const json = (await res.json()) as { success?: boolean; message?: string; error?: string };
      if (res.ok && json.success) {
        toast.success(json.message ?? t('successToast'));
        setIsDialogOpen(false);
        setReason('');
        window.location.reload();
      } else {
        toast.error(json.error ?? t('errorToast'));
      }
    } catch {
      toast.error(t('errorToast'));
    } finally {
      setIsRotating(false);
    }
  };

  return (
    <main className="min-h-screen bg-background p-8">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">{t('title')}</h1>
            <p className="text-muted-foreground mt-1">{t('subtitle')}</p>
          </div>
          <Button
            type="button"
            variant="default"
            onClick={() => setIsDialogOpen(true)}
            disabled={isRotating}
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            {t('rotateNow')}
          </Button>
        </div>

        <CurrentVersionCard currentVersion={currentVersion} locale={locale} />
        <VersionHistoryCard history={versionHistory} locale={locale} />
        <AuditLogsCard logs={auditLogs} locale={locale} />
      </div>

      <RotationDialog
        isOpen={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        reason={reason}
        onReasonChange={setReason}
        onConfirm={handleRotate}
        isRotating={isRotating}
      />
    </main>
  );
}
