'use client';

/**
 * SopDetailTabs — client tab navigation for SOP installation detail.
 *
 * Tabs: Overview / Runs / Analytics / Edit / Webhook
 * Each tab content is a separate component for ≤200 LOC compliance.
 */

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import type { SopInstallationRow, SopRunRow, SopTemplateRow } from '@/tree/sop/sop-types';

// Each tab is a thin, focused component.
import { InstallationOverviewTab } from '@/components/sop/detail/installation-overview-tab';
import { InstallationRunsTab } from '@/components/sop/detail/installation-runs-tab';
import { InstallationEditTab } from '@/components/sop/detail/installation-edit-tab';
import { InstallationWebhookTab } from '@/components/sop/detail/installation-webhook-tab';
import { SopAnalyticsTab } from '@/components/sop/detail/analytics-tab';

type TabKey = 'overview' | 'runs' | 'analytics' | 'edit' | 'webhook';

interface Props {
  installation: SopInstallationRow;
  runs: SopRunRow[];
  playbookMd: string;
  installationId: string;
  locale: string;
  configSchema: string | null;
  configDefaults: string | null;
  template: SopTemplateRow | null;
  onRunNow: (installationId: string) => Promise<{ error?: string }>;
  onDelete: (installationId: string) => Promise<{ error?: string }>;
  onSavePlaybook: (installationId: string, md: string) => Promise<{ error?: string }>;
  onSaveConfig: (config: Record<string, unknown>) => Promise<{ error?: string }>;
  onRegenSecret: (installationId: string) => Promise<{ error?: string; webhookSecret?: string }>;
}

export function SopDetailTabs({
  installation,
  runs,
  playbookMd,
  installationId,
  configSchema,
  configDefaults,
  template,
  onRunNow,
  onDelete,
  onSavePlaybook,
  onSaveConfig,
  onRegenSecret,
}: Props) {
  const [activeTab, setActiveTab] = useState<TabKey>('overview');
  const t = useTranslations('sop.detail_page');

  const tabs: Array<{ key: TabKey; label: string }> = [
    { key: 'overview', label: t('overview') },
    { key: 'runs', label: `${t('runs')} (${runs.length})` },
    { key: 'analytics', label: t('analytics') },
    { key: 'edit', label: t('edit') },
    { key: 'webhook', label: t('webhook') },
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
                ? 'border-primary-500 text-primary-300'
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
            onRunNow={() => onRunNow(installationId)}
            onDelete={() => onDelete(installationId)}
          />
        )}

        {activeTab === 'runs' && (
          <InstallationRunsTab runs={runs} installationId={installationId} />
        )}

        {activeTab === 'analytics' && (
          <SopAnalyticsTab runs={runs} sopId={installationId} template={template} />
        )}

        {activeTab === 'edit' && (
          <InstallationEditTab
            playbookMd={playbookMd}
            configSchema={configSchema}
            configDefaults={configDefaults}
            configValues={installation.config_values}
            onSave={(value) => onSavePlaybook(installationId, value)}
            onSaveConfig={(values) => onSaveConfig(values)}
          />
        )}

        {activeTab === 'webhook' && (
          <InstallationWebhookTab
            installationId={installationId}
            onRegenSecret={() => onRegenSecret(installationId)}
          />
        )}
      </div>
    </div>
  );
}
