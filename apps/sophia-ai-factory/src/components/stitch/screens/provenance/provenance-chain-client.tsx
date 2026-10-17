'use client';

import React, { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Search } from 'lucide-react';
import { Card, Button, Input } from '@/components/stitch/ui';
import { DashboardLayout } from '@/components/stitch/layouts';
import {
  ProvenanceRecordsTable,
  type ProvenanceRecord,
} from './provenance-records-table';

export type { ProvenanceRecord };

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
      const data = (await res.json()) as {
        chain?: ProvenanceRecord[];
        derivatives?: ProvenanceRecord[];
      };
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

      <ProvenanceRecordsTable
        records={allRecords}
        traced={traced}
        loading={loading}
      />
    </DashboardLayout>
  );
}
