'use client';

/**
 * LicensesClient — searchable table for admin license management.
 * Fetches from /api/admin/licenses, supports extend/reactivate/regenerate.
 */

import { useState, useEffect, useCallback } from 'react';
import { KeyRound, RefreshCw, CheckCircle, XCircle, Search, Loader2 } from 'lucide-react';

interface License {
  id: string;
  user_id: string;
  tier: string;
  status: string;
  expires_at: string | null;
  created_at: string;
  license_key: string;
}

interface ApiResult {
  licenses: License[];
  total: number;
  page: number;
  limit: number;
}

export function LicensesClient({ initialLicenses }: { initialLicenses?: License[] } = {}): React.JSX.Element {
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
      const res = await fetch(`/api/admin/licenses?\${params}`, { cache: 'no-store' });
      if (!res.ok) throw new Error(`HTTP \${res.status}`);
      const data: ApiResult = await res.json();
      setLicenses(data.licenses ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load licenses');
    } finally {
      setLoading(false);
    }
  }, [search, tierFilter]);

  useEffect(() => { fetchLicenses(); }, [fetchLicenses]);

  async function handleAction(licenseId: string, action: 'extend' | 'reactivate' | 'regenerate') {
    setActionId(licenseId);
    try {
      const endpoints: Record<string, string> = {
        extend: `/api/admin/licenses/\${licenseId}/extend`,
        reactivate: `/api/admin/licenses/\${licenseId}/reactivate`,
        regenerate: `/api/admin/licenses/\${licenseId}/regenerate`,
      };
      const res = await fetch(endpoints[action], { method: 'POST' });
      if (!res.ok) throw new Error(`Action failed: \${res.status}`);
      await fetchLicenses();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Action failed');
    } finally {
      setActionId(null);
    }
  }

  const tiers = ['BASIC', 'PREMIUM', 'ENTERPRISE', 'MASTER'];

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search by license ID or user..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 rounded-lg border border-border bg-card text-sm"
          />
        </div>
        <select
          value={tierFilter}
          onChange={(e) => setTierFilter(e.target.value)}
          className="px-3 py-2 rounded-lg border border-border bg-card text-sm"
        >
          <option value="">All tiers</option>
          {tiers.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        <button
          onClick={fetchLicenses}
          className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border bg-card text-sm hover:bg-muted transition-colors"
        >
          <RefreshCw className={`w-4 h-4 \${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">
          {error}
        </div>
      )}

      {/* Table */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-xs text-muted-foreground">
                <th className="px-4 py-3 text-left font-medium">License ID</th>
                <th className="px-4 py-3 text-left font-medium">User</th>
                <th className="px-4 py-3 text-left font-medium">Tier</th>
                <th className="px-4 py-3 text-left font-medium">Status</th>
                <th className="px-4 py-3 text-left font-medium">Expires</th>
                <th className="px-4 py-3 text-left font-medium">Created</th>
                <th className="px-4 py-3 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading && licenses.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto text-muted-foreground" />
                  </td>
                </tr>
              ) : licenses.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-muted-foreground">
                    No licenses found
                  </td>
                </tr>
              ) : (
                licenses.map((lic) => (
                  <tr key={lic.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3">
                      <code className="font-mono text-xs bg-muted px-2 py-0.5 rounded">
                        {lic.license_key}
                      </code>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {lic.user_id.slice(0, 8)}...
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium \${getTierColor(lic.tier)}`}>
                        {lic.tier}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs \${getStatusColor(lic.status)}`}>
                        {lic.status === 'active' ? <CheckCircle className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                        {lic.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {lic.expires_at ? new Date(lic.expires_at).toLocaleDateString() : 'Never'}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {new Date(lic.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <ActionBtn
                          icon={RefreshCw}
                          label="Extend"
                          onClick={() => handleAction(lic.id, 'extend')}
                          busy={actionId === lic.id}
                        />
                        <ActionBtn
                          icon={CheckCircle}
                          label="Reactivate"
                          onClick={() => handleAction(lic.id, 'reactivate')}
                          busy={actionId === lic.id}
                        />
                        <ActionBtn
                          icon={KeyRound}
                          label="Regenerate"
                          onClick={() => handleAction(lic.id, 'regenerate')}
                          busy={actionId === lic.id}
                        />
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function ActionBtn({ icon: Icon, label, onClick, busy }: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  onClick: () => void;
  busy: boolean;
}): React.JSX.Element {
  return (
    <button
      onClick={onClick}
      disabled={busy}
      title={label}
      className={`p-1.5 rounded-md hover:bg-muted transition-colors disabled:opacity-50 \${label === 'Regenerate' ? 'text-amber-500 hover:text-amber-400' : 'text-muted-foreground hover:text-foreground'}`}
    >
      {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Icon className="w-3.5 h-3.5" />}
    </button>
  );
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function getTierColor(tier: string): string {
  switch (tier) {
    case 'MASTER': return 'bg-primary/10 text-primary border border-primary/20';
    case 'ENTERPRISE': return 'bg-blue-500/10 text-blue-400 border border-blue-500/20';
    case 'PREMIUM': return 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20';
    default: return 'bg-muted text-muted-foreground';
  }
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function getStatusColor(status: string): string {
  if (status === 'active') return 'bg-emerald-500/10 text-emerald-400';
  if (status === 'revoked') return 'bg-red-500/10 text-red-400';
  return 'bg-amber-500/10 text-amber-400'; // expired
}
