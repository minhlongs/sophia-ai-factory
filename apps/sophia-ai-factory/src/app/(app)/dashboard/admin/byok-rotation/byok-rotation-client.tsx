'use client';

/**
 * BYOK Master Key Rotation — interactive client console.
 *
 * Renders the current master key version card, version history table,
 * rotation audit trail, and a "Rotate Now" action with confirmation dialog.
 *
 * @module app/[locale]/dashboard/admin/byok-rotation/byok-rotation-client
 */

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { RefreshCw, ShieldCheck, Clock, AlertTriangle, FileText } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/seed/components/ui/card';
import { Button } from '@/seed/components/ui/button';
import { Badge } from '@/seed/components/ui/badge';
import { Input } from '@/seed/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/seed/components/ui/dialog';
import { toast } from 'sonner';
import type { KeyVersionItem, AuditLogItem } from './page';

interface ByokRotationClientProps {
  locale: string;
  currentVersion: KeyVersionItem | null;
  versionHistory: KeyVersionItem[];
  auditLogs: AuditLogItem[];
}

function parseDate(value: string | number | null | undefined): Date | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number') {
    return new Date(value * 1000);
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function formatDate(value: string | number | null | undefined, locale: string): string {
  const date = parseDate(value);
  if (!date) return '—';
  return date.toLocaleDateString(locale === 'vi' ? 'vi-VN' : 'en-US', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function daysSince(value: string | number | null | undefined): number | null {
  const date = parseDate(value);
  if (!date) return null;
  const diffMs = Date.now() - date.getTime();
  if (diffMs < 0) return 0;
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}

export function ByokRotationClient({
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

function CurrentVersionCard({
  currentVersion,
  locale,
}: {
  currentVersion: KeyVersionItem | null;
  locale: string;
}) {
  const t = useTranslations('admin.keyRotation');
  const ageInDays = daysSince(currentVersion?.created_at ?? null);

  return (
    <Card className="mb-8">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ShieldCheck className="w-5 h-5 text-primary" />
          {t('currentVersion')}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {currentVersion ? (
          <div className="grid gap-4 md:grid-cols-4">
            <div>
              <p className="text-sm text-muted-foreground">{t('version')}</p>
              <p className="text-2xl font-bold text-foreground mt-1">v{currentVersion.version}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">{t('keyType')}</p>
              <p className="text-lg font-medium text-foreground mt-1">{currentVersion.key_type}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">{t('createdAt')}</p>
              <p className="text-lg font-medium text-foreground mt-1">
                {formatDate(currentVersion.created_at, locale)}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">{t('age')}</p>
              <p className="text-lg font-medium text-foreground mt-1">
                {ageInDays !== null ? t('daysAgo', { days: ageInDays }) : '—'}
              </p>
            </div>
            <div className="md:col-span-4 flex items-center gap-3 pt-2">
              <Badge variant={currentVersion.is_active === 1 ? 'default' : 'secondary'}>
                {currentVersion.is_active === 1 ? t('activeStatus') : t('inactiveStatus')}
              </Badge>
              <span className="text-sm text-muted-foreground flex items-center gap-1">
                <Clock className="w-4 h-4" />
                {t('dualDecryptNotice')}
              </span>
            </div>
          </div>
        ) : (
          <div className="text-center py-6">
            <AlertTriangle className="w-10 h-10 text-amber-500 mx-auto mb-3" />
            <p className="text-muted-foreground">{t('noActiveKey')}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function VersionHistoryCard({
  history,
  locale,
}: {
  history: KeyVersionItem[];
  locale: string;
}) {
  const t = useTranslations('admin.keyRotation');

  return (
    <Card className="mb-8">
      <CardHeader>
        <CardTitle>{t('historyTitle')}</CardTitle>
        <p className="text-sm text-muted-foreground">{t('historySubtitle')}</p>
      </CardHeader>
      <CardContent>
        {history.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b text-left text-sm text-muted-foreground">
                  <th className="p-3 font-medium">{t('columns.version')}</th>
                  <th className="p-3 font-medium">{t('columns.keyType')}</th>
                  <th className="p-3 font-medium">{t('columns.status')}</th>
                  <th className="p-3 font-medium">{t('columns.createdAt')}</th>
                  <th className="p-3 font-medium">{t('columns.rotatedAt')}</th>
                  <th className="p-3 font-medium">{t('columns.rotatedBy')}</th>
                </tr>
              </thead>
              <tbody>
                {history.map((row) => (
                  <tr key={row.id} className="border-b hover:bg-muted/30">
                    <td className="p-3 font-medium text-foreground">v{row.version}</td>
                    <td className="p-3 text-foreground">{row.key_type}</td>
                    <td className="p-3">
                      <Badge variant={row.is_active === 1 ? 'default' : 'secondary'}>
                        {row.is_active === 1 ? t('activeStatus') : t('inactiveStatus')}
                      </Badge>
                    </td>
                    <td className="p-3 text-sm text-muted-foreground">
                      {formatDate(row.created_at, locale)}
                    </td>
                    <td className="p-3 text-sm text-muted-foreground">
                      {formatDate(row.rotated_at, locale)}
                    </td>
                    <td className="p-3 text-sm text-muted-foreground">
                      {row.rotated_by ?? '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-8">
            <FileText className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground">{t('emptyHistory')}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function AuditLogsCard({
  logs,
  locale,
}: {
  logs: AuditLogItem[];
  locale: string;
}) {
  const t = useTranslations('admin.keyRotation');

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('auditTitle')}</CardTitle>
        <p className="text-sm text-muted-foreground">{t('auditSubtitle')}</p>
      </CardHeader>
      <CardContent>
        {logs.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b text-left text-sm text-muted-foreground">
                  <th className="p-3 font-medium">{t('columns.action')}</th>
                  <th className="p-3 font-medium">{t('columns.timestamp')}</th>
                  <th className="p-3 font-medium">{t('columns.actor')}</th>
                  <th className="p-3 font-medium">{t('columns.details')}</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log.id} className="border-b hover:bg-muted/30">
                    <td className="p-3">
                      <code className="text-xs bg-muted px-1.5 py-0.5 rounded font-mono">
                        {log.action}
                      </code>
                    </td>
                    <td className="p-3 text-sm text-muted-foreground">
                      {formatDate(log.created_at, locale)}
                    </td>
                    <td className="p-3 text-sm text-muted-foreground">
                      {log.user_id ?? '—'}
                    </td>
                    <td className="p-3 text-sm text-muted-foreground max-w-xs truncate">
                      {log.details ?? '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-8">
            <FileText className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground">{t('emptyAudit')}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function RotationDialog({
  isOpen,
  onOpenChange,
  reason,
  onReasonChange,
  onConfirm,
  isRotating,
}: {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  reason: string;
  onReasonChange: (reason: string) => void;
  onConfirm: () => void;
  isRotating: boolean;
}) {
  const t = useTranslations('admin.keyRotation');

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('dialogTitle')}</DialogTitle>
          <DialogDescription>{t('dialogDescription')}</DialogDescription>
        </DialogHeader>
        <div className="py-2">
          <label htmlFor="rotation-reason" className="text-sm font-medium text-foreground">
            {t('reasonLabel')}
          </label>
          <Input
            id="rotation-reason"
            value={reason}
            onChange={(e) => onReasonChange(e.target.value)}
            placeholder={t('reasonPlaceholder')}
            maxLength={500}
            className="mt-2"
          />
        </div>
        <DialogFooter>
          <Button
            type="button"
            variant="secondary"
            onClick={() => {
              onOpenChange(false);
              onReasonChange('');
            }}
            disabled={isRotating}
          >
            {t('cancel')}
          </Button>
          <Button
            type="button"
            variant="default"
            onClick={onConfirm}
            disabled={isRotating}
          >
            {isRotating ? t('rotating') : t('confirm')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
