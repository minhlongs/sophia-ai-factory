'use client';

/**
 * InstallationListTable — table of user's SOP installations.
 *
 * Columns: Name, Category, Schedule, Last Run (status badge), Runs, Enabled, Actions.
 */

import { useTranslations } from 'next-intl';
import Link from 'next/link';
import type { SopInstallationRow, SopTemplateRow } from '@/tree/sop/sop-types';
import { CategoryBadge } from './category-badge';
import { Button } from '@/seed/components/ui/button';
import { Eye, Package } from 'lucide-react';
import { EmptyState } from '@/seed/components/ui/empty-state';

interface InstallWithTemplate extends SopInstallationRow {
  template: SopTemplateRow | null;
}

interface InstallationListTableProps {
  installations: InstallWithTemplate[];
  locale: string;
}

function formatDate(ts: number | null): string {
  if (!ts) return '—';
  return new Date(ts * 1000).toLocaleDateString();
}

function formatCron(cron: string | null, manual: string): string {
  if (!cron) return manual;
  if (cron === '0 * * * *') return 'Every hour';
  if (cron === '0 9 * * *') return 'Daily 9 AM';
  if (cron === '0 9 * * 1') return 'Weekly Mon';
  return cron;
}

export function InstallationListTable({ installations, locale }: InstallationListTableProps) {
  const t = useTranslations('sop.list');
  const isVi = locale.startsWith('vi');

  if (installations.length === 0) {
    return (
      <EmptyState
        icon={Package}
        title={t('emptyTitle')}
        description={t('emptyDesc')}
        cta={{ label: t('emptyAction'), href: '/dashboard/sop-marketplace' }}
      />
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-border">
      <table className="w-full text-sm">
        <thead className="bg-card">
          <tr className="border-b border-border">
            <th className="text-left px-4 py-3 text-muted-foreground font-medium">{t('name')}</th>
            <th className="text-left px-4 py-3 text-muted-foreground font-medium">{t('schedule')}</th>
            <th className="text-left px-4 py-3 text-muted-foreground font-medium">{t('lastRun')}</th>
            <th className="text-left px-4 py-3 text-muted-foreground font-medium">{t('runCount')}</th>
            <th className="text-left px-4 py-3 text-muted-foreground font-medium">{t('enabled')}</th>
            <th className="text-left px-4 py-3 text-muted-foreground font-medium">{t('actions')}</th>
          </tr>
        </thead>
        <tbody>
          {installations.map((inst) => {
            const name = inst.template
              ? (isVi ? inst.template.name_vi : inst.template.name_en)
              : inst.template_id;

            return (
              <tr key={inst.id} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-foreground truncate max-w-[200px]">{name}</span>
                    {inst.template && <CategoryBadge category={inst.template.category} />}
                  </div>
                </td>
                <td className="px-4 py-3 text-muted-foreground">{formatCron(inst.schedule_cron, t('manual'))}</td>
                <td className="px-4 py-3 text-muted-foreground">{formatDate(inst.last_run_at)}</td>
                <td className="px-4 py-3 text-muted-foreground">{inst.run_count}</td>
                <td className="px-4 py-3">
                  <span className={`inline-flex h-2 w-2 rounded-full ${inst.enabled ? 'bg-emerald-400' : 'bg-muted-foreground'}`} />
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <Link href={`/dashboard/sops/${inst.id}`}>
                      <Button size="sm" variant="outline" className="h-7 px-2">
                        <Eye className="w-3.5 h-3.5" aria-hidden="true" />
                      </Button>
                    </Link>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
