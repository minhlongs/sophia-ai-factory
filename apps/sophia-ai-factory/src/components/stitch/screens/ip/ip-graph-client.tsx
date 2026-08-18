'use client';

import React, { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Plus } from 'lucide-react';
import { Card, Button, Input } from '@/components/stitch/ui';
import { DashboardLayout } from '@/components/stitch/layouts';
import { IpGraphTable } from '@/components/stitch/screens/ip/ip-graph-table';

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

export function IpGraphClient({ workspaceId }: { workspaceId: string }) {
  const t = useTranslations('dashboard.ip');
  const [entities, setEntities] = useState<IpEntity[]>([]);
  const [query, setQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({
    type: 'universe',
    name: '',
    description: '',
    parentId: '',
  });

  async function load() {
    if (!workspaceId) return;
    setLoading(true);
    try {
      const url = new URL('/api/ip-graph', window.location.origin);
      url.searchParams.set('workspaceId', workspaceId);
      if (typeFilter !== 'all') url.searchParams.set('type', typeFilter);
      const res = await fetch(url);
      const data = (await res.json()) as { entities?: IpEntity[] };
      if (res.ok && Array.isArray(data.entities)) {
        setEntities(data.entities);
      }
    } finally {
      setLoading(false);
    }
  }

  React.useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspaceId, typeFilter]);

  async function createEntity(e: React.FormEvent) {
    e.preventDefault();
    if (!workspaceId || !form.name.trim()) return;
    setCreating(true);
    try {
      const res = await fetch('/api/ip-graph', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspaceId,
          type: form.type,
          name: form.name.trim(),
          description: form.description.trim(),
          parentId: form.parentId.trim() || undefined,
        }),
      });
      if (res.ok) {
        setForm({ type: 'universe', name: '', description: '', parentId: '' });
        await load();
      }
    } finally {
      setCreating(false);
    }
  }

  async function updateStatus(entity: IpEntity, status: string) {
    try {
      const res = await fetch(`/api/ip-graph/${entity.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      if (res.ok) await load();
    } catch {
      // status update failure is non-fatal for the list view
    }
  }

  return (
    <DashboardLayout title={t('title')} subtitle={t('subtitle')}>
      <IpGraphTable
        entities={entities}
        query={query}
        onQueryChange={setQuery}
        onTypeFilterChange={setTypeFilter}
        typeFilter={typeFilter}
        onStatusChange={updateStatus}
        loading={loading}
        t={t}
      />

      <Card padding="lg" className="mt-6">
        <h2 className="text-title-lg">{t('create.title')}</h2>
        <p className="mt-1 text-body-sm text-on-surface-variant">{t('create.subtitle')}</p>
        <form className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2" onSubmit={createEntity}>
          <div>
            <label className="mb-1 block text-label-sm text-on-surface-variant">
              {t('create.type')}
            </label>
            <select
              className="w-full rounded-lg border border-outline bg-surface px-3 py-2 text-body-sm"
              value={form.type}
              onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}
            >
              <option value="universe">{t('type.universe')}</option>
              <option value="world">{t('type.world')}</option>
              <option value="series">{t('type.series')}</option>
              <option value="character">{t('type.character')}</option>
              <option value="theme">{t('type.theme')}</option>
              <option value="brand">{t('type.brand')}</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-label-sm text-on-surface-variant">
              {t('create.name')}
            </label>
            <Input
              placeholder={t('create.namePlaceholder')}
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              required
            />
          </div>
          <div className="sm:col-span-2">
            <label className="mb-1 block text-label-sm text-on-surface-variant">
              {t('create.description')}
            </label>
            <Input
              placeholder={t('create.descriptionPlaceholder')}
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            />
          </div>
          <div>
            <label className="mb-1 block text-label-sm text-on-surface-variant">
              {t('create.parent')}
            </label>
            <Input
              placeholder={t('create.parentPlaceholder')}
              value={form.parentId}
              onChange={(e) => setForm((f) => ({ ...f, parentId: e.target.value }))}
            />
          </div>
          <div className="flex items-end">
            <Button type="submit" variant="primary" loading={creating}>
              <Plus className="h-4 w-4" />
              {t('create.submit')}
            </Button>
          </div>
        </form>
      </Card>
    </DashboardLayout>
  );
}