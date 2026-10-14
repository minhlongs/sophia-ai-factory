// i18n-namespace: dashboard.ip

import React from 'react';
import { Eye, Pencil } from 'lucide-react';
import { Badge, Button, Table, Card } from '@/components/stitch/ui';
import { TYPE_META, STATUSES, type IpEntity } from './types';

interface IpEntityTableProps {
  filtered: IpEntity[];
  loading: boolean;
  onStatusChange: (entity: IpEntity, status: string) => void;
  t: (key: string) => string;
}

export function IpEntityTable({
  filtered,
  loading,
  onStatusChange,
  t,
}: IpEntityTableProps) {
  return (
    <Card padding="lg" className="mt-6 lg:col-span-4">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-title-lg">{t('list.title')}</h2>
        <Badge variant="soft" color="primary" size="sm">
          {filtered.length} {t('list.count')}
        </Badge>
      </div>
      <Table
        variant="embedded"
        data={filtered}
        columns={[
          {
            key: 'name',
            header: t('list.name'),
            cell: (entity) => {
              const meta = TYPE_META[entity.type] ?? TYPE_META.universe;
              const Icon = meta.icon;
              return (
                <div className="flex items-center gap-2">
                  <Icon className="h-4 w-4 text-on-surface-variant" />
                  <span className="font-medium">{entity.name}</span>
                </div>
              );
            },
          },
          {
            key: 'type',
            header: t('list.type'),
            cell: (entity) => (
              <Badge variant="soft" color="secondary" size="sm">
                {t(`type.${entity.type}` as const)}
              </Badge>
            ),
          },
          {
            key: 'status',
            header: t('list.status'),
            cell: (entity) => (
              <select
                className="rounded-lg border border-outline bg-surface px-2 py-1 text-body-sm"
                value={entity.status}
                onChange={(e) => onStatusChange(entity, e.target.value)}
              >
                {STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {t(`status.${s}` as const)}
                  </option>
                ))}
              </select>
            ),
          },
          {
            key: 'parent',
            header: t('list.parent'),
            cell: (entity) =>
              entity.parentId ? t('list.hasParent') : t('list.root'),
          },
          {
            key: 'updated',
            header: t('list.updated'),
            cell: (entity) => (
              <span className="text-on-surface-variant">
                {new Date(entity.updatedAt * 1000).toLocaleDateString()}
              </span>
            ),
          },
          {
            key: 'actions',
            header: t('list.actions'),
            cell: (_entity) => (
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  iconLeft={<Eye className="h-4 w-4" />}
                  aria-label={t('actions.view')}
                >
                  <span className="sr-only">{t('actions.view')}</span>
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  iconLeft={<Pencil className="h-4 w-4" />}
                  aria-label={t('actions.edit')}
                >
                  <span className="sr-only">{t('actions.edit')}</span>
                </Button>
              </div>
            ),
          },
        ]}
        emptyMessage={t('list.empty')}
        loading={loading}
      />
    </Card>
  );
}
