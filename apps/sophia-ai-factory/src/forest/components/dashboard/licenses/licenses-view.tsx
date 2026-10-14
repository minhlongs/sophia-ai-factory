'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { LicenseFilterBar } from './license-filter-bar';
import { LicenseTable } from './license-table';
import type { License, ApiResult, LicenseAction, LicensesClientProps } from './types';

export function LicensesView({ initialLicenses }: LicensesClientProps = {}): React.JSX.Element {
  const [licenses, setLicenses] = useState<License[]>(initialLicenses ?? []);
  const [loading, setLoading] = useState(!initialLicenses?.length);
  const [search, setSearch] = useState('');
  const [tierFilter, setTierFilter] = useState<string>('');
  const [actionId, setActionId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchLicenses = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ limit: '50' });
      if (search) params.set('search', search);
      if (tierFilter) params.set('tier', tierFilter);
      const res = await fetch(`/api/admin/licenses?${params}`, { cache: 'no-store' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: ApiResult = await res.json();
      setLicenses(data.licenses ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load licenses');
    } finally {
      setLoading(false);
    }
  }, [search, tierFilter]);

  useEffect(() => {
    fetchLicenses();
  }, [fetchLicenses]);

  async function handleAction(licenseId: string, action: LicenseAction) {
    setActionId(licenseId);
    try {
      const endpoints: Record<LicenseAction, string> = {
        extend: `/api/admin/licenses/${licenseId}/extend`,
        reactivate: `/api/admin/licenses/${licenseId}/reactivate`,
        regenerate: `/api/admin/licenses/${licenseId}/regenerate`,
      };
      const res = await fetch(endpoints[action], { method: 'POST' });
      if (!res.ok) throw new Error(`Action failed: ${res.status}`);
      await fetchLicenses();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Action failed');
    } finally {
      setActionId(null);
    }
  }

  return (
    <div className="space-y-4">
      <LicenseFilterBar
        search={search}
        onSearchChange={setSearch}
        tierFilter={tierFilter}
        onTierFilterChange={setTierFilter}
        loading={loading}
        onRefresh={fetchLicenses}
      />

      {error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">
          {error}
        </div>
      )}

      <LicenseTable
        licenses={licenses}
        loading={loading}
        actionId={actionId}
        onAction={handleAction}
      />
    </div>
  );
}
