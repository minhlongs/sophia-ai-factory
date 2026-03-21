'use client';

/**
 * RaaS API Key Manager UI Component
 *
 * - Lists org API keys (prefix, name, status, last used)
 * - Create / revoke keys via modals (see api-key-modals.tsx)
 * - Usage stats summary (calls today, MCU consumed, avg response time)
 */

import { useEffect, useState } from 'react';
import { CreateKeyModal, ShowKeyModal, RevokeConfirmModal } from './api-key-modals';

// ── Local types ───────────────────────────────────────────────────────────────

interface ApiKeyInfo {
  id: string;
  name: string;
  key_prefix: string;
  permissions: string[];
  rate_limit_per_minute: number;
  is_active: boolean;
  last_used_at: string | null;
  created_at: string;
  expires_at: string | null;
}

interface UsageStats {
  total_calls: number;
  total_mcu: number;
  avg_response_ms: number;
  calls_by_day: { date: string; count: number; mcu: number }[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(dateStr: string | null): string {
  if (!dateStr) return 'Never';
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  });
}

function todayCalls(stats: UsageStats | null): number {
  if (!stats) return 0;
  const today = new Date().toISOString().substring(0, 10);
  return stats.calls_by_day.find((d) => d.date === today)?.count ?? 0;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function ApiKeyManager() {
  const [keys, setKeys] = useState<ApiKeyInfo[]>([]);
  const [stats, setStats] = useState<UsageStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [newKeyName, setNewKeyName] = useState('');
  const [createdKey, setCreatedKey] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [revokeId, setRevokeId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const [keysRes, usageRes] = await Promise.all([
        fetch('/api/raas/keys'),
        fetch('/api/raas/usage?days=30'),
      ]);
      const keysData = await keysRes.json();
      const usageData = await usageRes.json();
      setKeys(keysData.keys ?? []);
      setStats(usageData.stats ?? null);
    } catch {
      setError('Failed to load data');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function handleCreate() {
    if (!newKeyName.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/raas/keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newKeyName.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Failed');
      setCreatedKey(data.key);
      setNewKeyName('');
      await load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to create key');
    } finally {
      setSaving(false);
    }
  }

  async function handleRevoke(id: string) {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/raas/keys/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to revoke');
      setRevokeId(null);
      await load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to revoke key');
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="p-8 text-gray-500">Loading...</div>;

  return (
    <div className="space-y-8">
      {/* Usage summary */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Calls today',          value: todayCalls(stats) },
          { label: 'MCU consumed (30d)',    value: stats?.total_mcu ?? 0 },
          { label: 'Avg response (ms)',     value: stats?.avg_response_ms ?? 0 },
        ].map(({ label, value }) => (
          <div key={label} className="rounded-lg border border-gray-200 bg-white p-4">
            <p className="text-sm text-gray-500">{label}</p>
            <p className="mt-1 text-2xl font-semibold text-gray-900">{value.toLocaleString()}</p>
          </div>
        ))}
      </div>

      {/* Error */}
      {error && (
        <div className="rounded bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Header + create button */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">API Keys</h2>
        <button
          onClick={() => setShowCreate(true)}
          className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
        >
          Create key
        </button>
      </div>

      {/* Key list */}
      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
        {keys.length === 0 ? (
          <p className="p-6 text-sm text-gray-500">No API keys yet.</p>
        ) : (
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                {['Name', 'Key prefix', 'Status', 'Last used', 'Created', ''].map((h) => (
                  <th key={h} className="px-4 py-3 text-left font-medium text-gray-500">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {keys.map((k) => (
                <tr key={k.id}>
                  <td className="px-4 py-3 font-medium text-gray-900">{k.name}</td>
                  <td className="px-4 py-3 font-mono text-gray-600">{k.key_prefix}…</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                      k.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                    }`}>
                      {k.is_active ? 'Active' : 'Revoked'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-500">{fmt(k.last_used_at)}</td>
                  <td className="px-4 py-3 text-gray-500">{fmt(k.created_at)}</td>
                  <td className="px-4 py-3 text-right">
                    {k.is_active && (
                      <button
                        onClick={() => setRevokeId(k.id)}
                        className="text-red-600 hover:text-red-800 text-xs font-medium"
                      >
                        Revoke
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Modals */}
      {showCreate && !createdKey && (
        <CreateKeyModal
          name={newKeyName}
          saving={saving}
          onChangeName={setNewKeyName}
          onCreate={handleCreate}
          onCancel={() => setShowCreate(false)}
        />
      )}
      {createdKey && (
        <ShowKeyModal
          apiKey={createdKey}
          onDone={() => { setCreatedKey(null); setShowCreate(false); }}
        />
      )}
      {revokeId && (
        <RevokeConfirmModal
          saving={saving}
          onConfirm={() => handleRevoke(revokeId)}
          onCancel={() => setRevokeId(null)}
        />
      )}
    </div>
  );
}
