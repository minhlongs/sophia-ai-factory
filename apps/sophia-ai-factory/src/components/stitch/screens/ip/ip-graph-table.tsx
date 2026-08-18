'use client';

import {
  Eye,
  Pencil,
  Search,
  Filter,
  Globe,
  BookOpen,
  Users,
  Palette,
  Building2,
} from 'lucide-react';
import { Badge, Button, Input, Table, Card } from '@/components/stitch/ui';

const TYPE_META: Record<string, { icon: React.ElementType; label: string }> = {
  universe: { icon: Globe, label: 'Universe' },
  world: { icon: Globe, label: 'World' },
  series: { icon: BookOpen, label: 'Series' },
  character: { icon: Users, label: 'Character' },
  theme: { icon: Palette, label: 'Theme' },
  brand: { icon: Building2, label: 'Brand' },
};

const STATUSES = [
  'draft',
  'planned',
  'in_production',
  'review',
  'approved',
  'published',
  'archived',
];

interface IpEntity {
  id: string;
  workspaceId: string;
  type: string;
  name: string;
  description: string;
  status: string;
  parentId: string | null;
  createdAt: number;
  updatedAt: number;
}

interface IpGraphTableProps {
  entities: IpEntity[];
  query: string;
  onQueryChange: (value: string) => void;
  onTypeFilterChange: (value: string) => void;
  typeFilter: string;
  onStatusChange: (entity: IpEntity, status: string) => void;
  loading: boolean;
  t: (key: string) => string;
}

export function IpGraphTable({
  entities,
  query,
  onQueryChange,
  onTypeFilterChange,
  typeFilter,
  onStatusChange,
  loading,
  t,
}: IpGraphTableProps) {
  const filtered = entities.filter(
    (e) =>
      e.name.toLowerCase().includes(query.toLowerCase()) ||
      e.description.toLowerCase().includes(query.toLowerCase()),
  );

  const counts = entities.reduce<Record<string, number>>((acc, e) => {
    acc[e.type] = (acc[e.type] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-4">
      {Object.entries(TYPE_META).map(([type, meta]) => {
        const Icon = meta.icon;
        return (
          <Card key={type} padding="lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-label-sm text-on-surface-variant">{t(`type.${type}` as const)}</p>
                <p className="text-headline-sm">{counts[type] ?? 0}</p>
              </div>
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-container text-on-primary-container">
                <Icon className="h-5 w-5" />
              </div>
            </div>
          </Card>
        );
      })}

      <Card padding="lg" className="mt-6 lg:col-span-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-1 items-center gap-2">
            <Search className="h-4 w-4 text-on-surface-variant" />
            <Input
              placeholder={t('search')}
              value={query}
              onChange={(e) => onQueryChange(e.target.value)}
              className="flex-1"
            />
          </div>
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-on-surface-variant" />
            <select
              className="rounded-lg border border-outline bg-surface px-3 py-2 text-body-sm"
              value={typeFilter}
              onChange={(e) => onTypeFilterChange(e.target.value)}
            >
              <option value="all">{t('filter.all')}</option>
              {Object.keys(TYPE_META).map((type) => (
                <option key={type} value={type}>
                  {t(`type.${type}` as const)}
                </option>
              ))}
            </select>
          </div>
        </div>
      </Card>

      <Card padding="lg" className="mt-6 lg:col-span-4">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-title-lg">{t('list.title')}</h2>
          <Badge variant="soft" color="primary" size="sm">
            {filtered.length} {t('list.count')}
          </Badge>
        </div>
        <Table
          data={filtered}
          columns={[
            {
              key: 'name',
              header: t('list.name'),
              cell: (entity) => (
                <div className="flex items-center gap-2">
                  {(() => {
                    const meta = TYPE_META[entity.type] ?? TYPE_META.universe;
                    const Icon = meta.icon;
                    return <Icon className="h-4 w-4 text-on-surface-variant" />;
                  })()}
                  <span className="font-medium">{entity.name}</span>
                </div>
              ),
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
    </div>
  );
}