'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import { Eye, Clock, GitBranch, User, Cpu, FileText } from 'lucide-react';
import { Card, Button, Badge, Table } from '@/components/stitch/ui';

export interface ProvenanceRecord {
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

type ActionBadgeColor = 'primary' | 'secondary' | 'success' | 'warning' | 'error' | 'neutral';

const ACTION_META: Record<string, { label: string; color: ActionBadgeColor }> = {
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

interface ProvenanceRecordsTableProps {
  records: ProvenanceRecord[];
  traced: boolean;
  loading: boolean;
}

export function ProvenanceRecordsTable({ records, traced, loading }: ProvenanceRecordsTableProps) {
  const t = useTranslations('dashboard.provenance');

  return (
    <Card padding="lg" className="mt-6">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-title-lg">{t('list.title')}</h2>
        <Badge variant="soft" color="primary" size="sm">
          {records.length} {t('list.count')}
        </Badge>
      </div>
      {!traced ? (
        <div className="py-8 text-center text-on-surface-variant">
          <GitBranch className="mx-auto mb-2 h-8 w-8" />
          <p>{t('list.noAsset')}</p>
        </div>
      ) : (
        <Table
          variant="embedded"
          data={records}
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
            { key: 'model', header: t('list.model'), cell: (record) => record.model ?? '—' },
            { key: 'source', header: t('list.source'), cell: (record) => record.sourceAssetId ?? record.derivativeOf ?? '—' },
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
                <Button variant="ghost" size="sm" iconLeft={<Eye className="h-4 w-4" />} aria-label={t('actions.view')}>
                  <span className="sr-only">{t('actions.view')}</span>
                </Button>
              ),
            },
          ]}
          emptyMessage={t('list.empty')}
          loading={loading}
        />
      )}
    </Card>
  );
}
