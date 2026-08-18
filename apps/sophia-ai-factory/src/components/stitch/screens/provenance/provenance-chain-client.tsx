'use client';

import React, { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Search, Eye, Clock, GitBranch, User, Cpu, FileText } from 'lucide-react';
import { Card, Button, Input, Badge, Table } from '@/components/stitch/ui';
import { DashboardLayout } from '@/components/stitch/layouts';

interface ProvenanceRecord {
  id: string;
  workspaceId: string;
  assetId: string;
  agentRunId?: string;
  action: string;
  actorType: 'agent' | 'human';
  actorId: string;
  model?: string;
  modelVersion?: string;
  prompt?: string;
  sourceAssetId?: string;
  derivativeOf?: string;
  metadata?: Record<string, unknown>;
  createdAt: number;
}

const ACTION_META: Record<string, { label: string; color: 'primary' | 'secondary' | 'success' | 'warning' | 'error' | 'neutral' }> = {
  created: { label: 'created', color: 'primary' },
  generated: { label: 'generated', color: 'secondary' },
  edited: { label: 'edited', color: 'warning' },
  approved: { label: 'approved', color: 'success' },
  rejected: { label: 'rejected', color: 'error' },
  published: { label: 'published', color: 'success' },
  derived: { label: 'derived', color: 'primary' },
  archived: { label: 'archived', color: 'neutral' },
};

const ACTOR_META: Record<string, { icon: React.ElementType; label: string }> = {
  agent: { icon: Cpu, label: 'agent' },
  human: { icon: User, label: 'human' },
};

export function ProvenanceChainClient({ workspaceId: _workspaceId }: { workspaceId: string }) {
  void _workspaceId;
  const t = useTranslations('dashboard.provenance');
  const [assetId, setAssetId] = useState('');
  const [records, setRecords] = useState<ProvenanceRecord[]>([]);
  const [derivatives, setDerivatives] = useState<ProvenanceRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [traced, setTraced] = useState(false);

  async function trace(e: React.FormEvent) {
    e.preventDefault();
    if (!assetId.trim()) return;
    setLoading(true);
    setTraced(true);
    try {
      const url = new URL('/api/provenance', window.location.origin);
      url.searchParams.set('assetId', assetId.trim());
      url.searchParams.set('includeDerivatives', 'true');
      const res = await fetch(url);
      const data = (await res.json()) as { chain?: ProvenanceRecord[]; derivatives?: ProvenanceRecord[] };
      if (res.ok) {
        setRecords(data.chain ?? []);
        setDerivatives(data.derivatives ?? []);
      }
    } finally {
      setLoading(false);
    }
  }

  const allRecords = [...records, ...derivatives];

  return (
    <DashboardLayout title={t('title')} subtitle={t('subtitle')}>
      <Card padding="lg">
        <h2 className="text-title-lg">{t('create.title')}</h2>
        <p className="mt-1 text-body-sm text-on-surface-variant">{t('create.subtitle')}</p>
        <form className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-end" onSubmit={trace}>
          <div className="flex-1">
            <label className="mb-1 block text-label-sm text-on-surface-variant">
              {t('create.assetId')}
            </label>
            <Input
              placeholder={t('create.assetIdPlaceholder')}
              value={assetId}
              onChange={(e) => setAssetId(e.target.value)}
            />
          </div>
          <Button type="submit" variant="primary">
            <Search className="h-4 w-4" />
            {t('create.submit')}
          </Button>
        </form>
      </Card>

      <Card padding="lg" className="mt-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-title-lg">{t('list.title')}</h2>
          <Badge variant="soft" color="primary" size="sm">
            {allRecords.length} {t('list.count')}
          </Badge>
        </div>
        {!traced ? (
          <div className="py-8 text-center text-on-surface-variant">
            <GitBranch className="mx-auto mb-2 h-8 w-8" />
            <p>{t('list.noAsset')}</p>
          </div>
        ) : (
          <Table
            data={allRecords}
            columns={[
              {
                key: 'asset',
                header: t('list.asset'),
                cell: (record) => (
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-on-surface-variant" />
                    <span className="font-medium">{record.assetId}</span>
                  </div>
                ),
              },
              {
                key: 'action',
                header: t('list.action'),
                cell: (record) => {
                  const meta = ACTION_META[record.action] ?? { label: record.action, color: 'neutral' as const };
                  return <Badge variant="soft" color={meta.color} size="sm">{t(`action.${record.action}` as const)}</Badge>;
                },
              },
              {
                key: 'actor',
                header: t('list.actor'),
                cell: (record) => {
                  const meta = ACTOR_META[record.actorType] ?? { icon: User, label: record.actorType };
                  const Icon = meta.icon;
                  return (
                    <div className="flex items-center gap-2">
                      <Icon className="h-4 w-4 text-on-surface-variant" />
                      <span>{t(`actor.${record.actorType}` as const)}</span>
                    </div>
                  );
                },
              },
              {
                key: 'model',
                header: t('list.model'),
                cell: (record) => record.model ?? '—',
              },
              {
                key: 'source',
                header: t('list.source'),
                cell: (record) => record.sourceAssetId ?? record.derivativeOf ?? '—',
              },
              {
                key: 'updated',
                header: t('list.updated'),
                cell: (record) => (
                  <div className="flex items-center gap-2 text-on-surface-variant">
                    <Clock className="h-4 w-4" />
                    {new Date(record.createdAt * 1000).toLocaleString()}
                  </div>
                ),
              },
              {
                key: 'actions',
                header: t('list.actions'),
                cell: (_record) => (
                  <Button variant="ghost" size="sm" iconLeft={<Eye className="h-4 w-4" />} aria-label={t('actions.view')}><span className="sr-only">{t('actions.view')}</span></Button>
                ),
              },
            ]}
            emptyMessage={t('list.empty')}
            loading={loading}
          />
        )}
      </Card>
    </DashboardLayout>
  );
}