'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { DashboardLayout } from '@/components/stitch/layouts';
import { IpGraphTable } from '@/components/stitch/screens/ip/ip-graph-table';
import {
  IpEntityCreateCard,
  type IpEntity,
  type IpEntityFormState,
} from './ip-entity-create-card';

export {
  IpEntityCreateCard,
  type IpEntity,
  type IpEntityFormState,
  type IpEntityCreateCardProps,
} from './ip-entity-create-card';

export function IpGraphClient({ workspaceId }: { workspaceId: string }) {
  const t = useTranslations('dashboard.ip');
  const [entities, setEntities] = useState<IpEntity[]>([]);
  const [query, setQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState<IpEntityFormState>({
    type: 'universe',
    name: '',
    description: '',
    parentId: '',
  });

  const load = useCallback(async () => {
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
  }, [workspaceId, typeFilter]);

  useEffect(() => {
    void load();
  }, [load]);

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

      <IpEntityCreateCard
        form={form}
        setForm={setForm}
        creating={creating}
        onSubmit={createEntity}
        t={t}
      />
    </DashboardLayout>
  );
}
