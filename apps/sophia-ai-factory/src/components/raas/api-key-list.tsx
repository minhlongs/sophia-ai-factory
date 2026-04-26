'use client';

/**
 * API Key List
 *
 * Lists org API keys with copy prefix, status, and revoke actions.
 * Shows usage stats (calls today, MCU consumed, avg response time).
 */

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import type { ApiKeyInfo, UsageStats } from '@/types/raas';

function fmt(dateStr: string | null): string {
  if (!dateStr) return 'Never';
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function todayCalls(stats: UsageStats | null): number {
  if (!stats) return 0;
  const today = new Date().toISOString().substring(0, 10);
  return stats.calls_by_day.find(d => d.date === today)?.count ?? 0;
}

function CopyPrefixButton({ prefix }: { prefix: string }) {
  const [copied, setCopied] = useState(false);
  function handleCopy() {
    navigator.clipboard.writeText(prefix + '…').catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }
  return (
    <button onClick={handleCopy} title="Copy key prefix" aria-label="Copy key prefix"
      className="ml-1 text-muted-foreground hover:text-primary transition-colors">
      <span className="material-symbols-outlined text-sm">{copied ? 'check' : 'content_copy'}</span>
    </button>
  );
}

interface Props {
  onCreateKey: () => void;
  refreshTrigger?: number;
}

interface ApiKeysListResponse {
  keys?: ApiKeyInfo[];
  apiKeys?: ApiKeyInfo[];
}

interface UsageResponse {
  stats?: UsageStats;
}

export function ApiKeyList({ onCreateKey, refreshTrigger = 0 }: Props) {
  const t = useTranslations('dashboard.apiKeys');
  const [keys, setKeys] = useState<ApiKeyInfo[]>([]);
  const [stats, setStats] = useState<UsageStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [revoking, setRevoking] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const [keysRes, usageRes] = await Promise.all([
        fetch('/api/admin/api-keys'),
        fetch('/api/raas/usage?days=30'),
      ]);
      const keysData = (await keysRes.json()) as ApiKeysListResponse;
      const usageData = (await usageRes.json()) as UsageResponse;
      setKeys(keysData.keys ?? keysData.apiKeys ?? []);
      setStats(usageData.stats ?? null);
    } catch {
      setError('Failed to load data');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [refreshTrigger]);

  async function handleRevoke(id: string) {
    setRevoking(id);
    setError(null);
    try {
      const res = await fetch(`/api/admin/api-keys/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to revoke');
      await load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to revoke key');
    } finally {
      setRevoking(null);
    }
  }

  if (loading) {
    return (
      <div className="p-8 flex flex-col gap-4 animate-pulse">
        <div className="grid grid-cols-3 gap-4">
          {[0, 1, 2].map(i => (
            <div key={i} className="rounded-lg border border-border bg-card p-4">
              <div className="h-3 bg-muted rounded w-24 mb-3" />
              <div className="h-7 bg-muted rounded w-16" />
            </div>
          ))}
        </div>
        <div className="rounded-lg border border-border bg-card h-40" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Usage summary */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: t('calls_today'),     value: todayCalls(stats) },
          { label: t('mcu_consumed'),    value: stats?.total_mcu ?? 0 },
          { label: t('avg_response_ms'), value: stats?.avg_response_ms ?? 0 },
        ].map(({ label, value }) => (
          <div key={label} className="rounded-lg border border-border bg-card p-4">
            <p className="text-sm text-muted-foreground">{label}</p>
            <p className="mt-1 text-2xl font-semibold text-foreground">{value.toLocaleString()}</p>
          </div>
        ))}
      </div>

      {error && (
        <div className="rounded bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-foreground">{t('title')}</h2>
        <button onClick={onCreateKey}
          className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors">
          {t('create_key')}
        </button>
      </div>

      {/* Key table */}
      <div className="overflow-hidden rounded-lg border border-border bg-card">
        {keys.length === 0 ? (
          <p className="p-6 text-sm text-muted-foreground">{t('no_keys')}</p>
        ) : (
          <table className="min-w-full divide-y divide-border text-sm">
            <thead className="bg-muted/50">
              <tr>
                {[t('col_name'), t('col_prefix'), t('col_status'), t('col_last_used'), t('col_created'), ''].map((h, i) => (
                  <th key={i} className="px-4 py-3 text-left font-medium text-muted-foreground">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {keys.map(k => (
                <tr key={k.id}>
                  <td className="px-4 py-3 font-medium text-foreground">{k.name}</td>
                  <td className="px-4 py-3 font-mono text-muted-foreground">
                    <span className="inline-flex items-center gap-1">
                      {k.key_prefix}…
                      <CopyPrefixButton prefix={k.key_prefix} />
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                      k.is_active ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-muted text-muted-foreground'
                    }`}>
                      {k.is_active ? t('active') : t('revoked')}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{fmt(k.last_used_at)}</td>
                  <td className="px-4 py-3 text-muted-foreground">{fmt(k.created_at)}</td>
                  <td className="px-4 py-3 text-right">
                    {k.is_active && (
                      <button
                        onClick={() => handleRevoke(k.id)}
                        disabled={revoking === k.id}
                        className="text-destructive hover:text-destructive/80 text-xs font-medium disabled:opacity-50"
                      >
                        {revoking === k.id ? '...' : t('revoke')}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
