'use client';

/**
 * SopDetailTabs — client tab navigation for SOP installation detail.
 *
 * Tabs: Overview / Runs / Edit / Webhook
 * Each tab content is a separate component for ≤200 LOC compliance.
 */

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import type { SopInstallationRow, SopRunRow } from '@/lib/sop/sop-types';
import { InstallationOverviewTab } from '@/components/sop/installation-overview-tab';
import { InstallationRunsTab } from '@/components/sop/installation-runs-tab';
import { InstallationEditTab } from '@/components/sop/installation-edit-tab';
import { InstallationWebhookTab } from '@/components/sop/installation-webhook-tab';

type TabKey = 'overview' | 'runs' | 'edit' | 'webhook';

interface Props {
  installation: SopInstallationRow;
  runs: SopRunRow[];
  playbookMd: string;
  installationId: string;
  locale: string;
  onRunNow: () => Promise<{ error?: string }>;
  onDelete: () => Promise<{ error?: string }>;
  onSavePlaybook: (v: string) => Promise<{ error?: string }>;
  onRegenSecret: () => Promise<{ error?: string; webhookSecret?: string }>;
}

export function SopDetailTabs({
  installation, runs, playbookMd, installationId, locale,
  onRunNow, onDelete, onSavePlaybook, onRegenSecret,
}: Props) {
  const t = useTranslations('sop.detail_page');
  const [activeTab, setActiveTab] = useState<TabKey>('overview');

  const tabs: Array<{ key: TabKey; label: string }> = [
    { key: 'overview', label: t('overview') },
    { key: 'runs',     label: `${t('runs')} (${runs.length})` },
    { key: 'edit',     label: t('edit') },
    { key: 'webhook',  label: t('webhook') },
  ];

  return (
    <div className="space-y-6">
      {/* Tab bar */}
      <div className="flex gap-1 border-b border-border">
        {tabs.map(({ key, label }) => (
          <button
            key={key}
            type="button"
            onClick={() => setActiveTab(key)}
            className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
              activeTab === key
                ? 'border-violet-500 text-violet-300'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div>
        {activeTab === 'overview' && (
          <InstallationOverviewTab
            installation={installation}
            onRunNow={onRunNow}
            onDelete={onDelete}
          />
        )}
        {activeTab === 'runs' && (
          <InstallationRunsTab runs={runs} installationId={installationId} />
        )}
        {activeTab === 'edit' && (
          <InstallationEditTab playbookMd={playbookMd} onSave={onSavePlaybook} />
        )}
        {activeTab === 'webhook' && (
          <InstallationWebhookTab installationId={installationId} onRegenSecret={onRegenSecret} />
        )}
      </div>
    </div>
  );
}
