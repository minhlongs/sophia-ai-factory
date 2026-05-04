/**
 * Client component for affiliate network BYOK management.
 * Shows 9 network cards with connect/test/delete actions.
 * @module app/[locale]/dashboard/integrations/affiliate-networks/affiliate-networks-client
 */
'use client';

import { useEffect, useState, useCallback } from 'react';

type NetworkStatus = 'active' | 'invalid' | 'rate_limited';

interface NetworkInfo {
  network: string;
  connected: boolean;
  status: NetworkStatus | null;
  last_validated_at: string | null;
}

interface FieldDef {
  key: string;
  label: string;
  placeholder: string;
  secret?: boolean;
}

const NETWORK_META: Record<string, { label: string; icon: string; fields: FieldDef[] }> = {
  impact_radius: {
    label: 'Impact Radius',
    icon: 'hub',
    fields: [
      { key: 'client_id', label: 'Client ID', placeholder: 'ir-...' },
      { key: 'client_secret', label: 'Client Secret', placeholder: '...', secret: true },
    ],
  },
  partnerstack: {
    label: 'PartnerStack',
    icon: 'handshake',
    fields: [{ key: 'api_key', label: 'API Key', placeholder: 'ps_...', secret: true }],
  },
  cj: {
    label: 'CJ Affiliate',
    icon: 'link',
    fields: [
      { key: 'api_key', label: 'API Key', placeholder: 'cj_...', secret: true },
      { key: 'website_id', label: 'Website ID (optional)', placeholder: '12345' },
    ],
  },
  shareasale: {
    label: 'ShareASale',
    icon: 'share',
    fields: [
      { key: 'api_token', label: 'API Token', placeholder: 'sas_...', secret: true },
      { key: 'affiliate_id', label: 'Affiliate ID', placeholder: '123456' },
    ],
  },
  clickbank: {
    label: 'ClickBank',
    icon: 'shopping_cart',
    fields: [
      { key: 'api_key', label: 'API Key', placeholder: 'DEV-...', secret: true },
      { key: 'clerk_key', label: 'Clerk Key (vendor)', placeholder: 'yourvendor' },
    ],
  },
  binance: {
    label: 'Binance',
    icon: 'currency_bitcoin',
    fields: [
      { key: 'api_key', label: 'API Key', placeholder: 'Kx...', secret: true },
      { key: 'api_secret', label: 'API Secret', placeholder: '...', secret: true },
    ],
  },
  bybit: {
    label: 'Bybit',
    icon: 'currency_bitcoin',
    fields: [
      { key: 'api_key', label: 'API Key', placeholder: 'by_...', secret: true },
      { key: 'api_secret', label: 'API Secret', placeholder: '...', secret: true },
    ],
  },
  bitget: {
    label: 'Bitget',
    icon: 'currency_bitcoin',
    fields: [
      { key: 'api_key', label: 'API Key', placeholder: 'bg_...', secret: true },
      { key: 'api_secret', label: 'API Secret', placeholder: '...', secret: true },
      { key: 'passphrase', label: 'Passphrase', placeholder: '...', secret: true },
    ],
  },
  coinbase: {
    label: 'Coinbase',
    icon: 'account_balance',
    fields: [
      { key: 'api_key', label: 'API Key', placeholder: 'cb_...', secret: true },
      { key: 'api_secret', label: 'API Secret', placeholder: '...', secret: true },
    ],
  },
};

const NETWORK_ORDER = Object.keys(NETWORK_META);

export default function AffiliateNetworksClient() {
  const [networks, setNetworks] = useState<NetworkInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeModal, setActiveModal] = useState<string | null>(null);
  const [formValues, setFormValues] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<Record<string, { valid: boolean; error?: string }>>({});

  const fetchNetworks = useCallback(async () => {
    try {
      const res = await fetch('/api/v1/integrations/affiliate-networks');
      const data = await res.json() as { networks: NetworkInfo[] };
      setNetworks(data.networks ?? []);
    } catch {
      // silently fail — user sees disconnected state
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void fetchNetworks(); }, [fetchNetworks]);

  async function handleSave(network: string) {
    setSaving(true);
    try {
      const res = await fetch('/api/v1/integrations/affiliate-networks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ network, payload: formValues }),
      });
      if (res.ok) {
        setActiveModal(null);
        setFormValues({});
        await fetchNetworks();
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(network: string) {
    if (!confirm(`Remove ${NETWORK_META[network]?.label ?? network} credentials?`)) return;
    await fetch(`/api/v1/integrations/affiliate-networks/${network}`, { method: 'DELETE' });
    await fetchNetworks();
  }

  async function handleTest(network: string) {
    setTesting(network);
    try {
      const res = await fetch(`/api/v1/integrations/affiliate-networks/${network}/validate`, { method: 'POST' });
      const data = await res.json() as { valid: boolean; error?: string };
      setTestResult(prev => ({ ...prev, [network]: data }));
      await fetchNetworks();
    } finally {
      setTesting(null);
    }
  }

  const getNetworkInfo = (n: string): NetworkInfo =>
    networks.find(x => x.network === n) ?? { network: n, connected: false, status: null, last_validated_at: null };

  if (loading) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">Affiliate Networks</h1>
        <p className="text-muted-foreground text-sm">Loading...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Affiliate Networks</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Add your personal API credentials to enable per-network affiliate tracking.
          Keys are encrypted with AES-256-GCM and never exposed in plaintext.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {NETWORK_ORDER.map(network => {
          const meta = NETWORK_META[network];
          const info = getNetworkInfo(network);
          const tr = testResult[network];

          return (
            <div key={network} className="bg-card border rounded-lg p-4 flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary text-xl">{meta.icon}</span>
                  <span className="font-medium text-sm">{meta.label}</span>
                </div>
                <StatusPill connected={info.connected} status={info.status} />
              </div>

              {tr && (
                <p className={`text-xs ${tr.valid ? 'text-green-600' : 'text-red-600'}`}>
                  {tr.valid ? 'Credentials valid' : (tr.error ?? 'Invalid credentials')}
                </p>
              )}

              <div className="flex gap-2 flex-wrap">
                <button
                  onClick={() => { setActiveModal(network); setFormValues({}); }}
                  className="text-xs px-3 py-1.5 border rounded-md hover:bg-muted transition-colors"
                >
                  {info.connected ? 'Edit' : 'Connect'}
                </button>
                {info.connected && (
                  <>
                    <button
                      onClick={() => handleTest(network)}
                      disabled={testing === network}
                      className="text-xs px-3 py-1.5 border rounded-md hover:bg-muted transition-colors disabled:opacity-50"
                    >
                      {testing === network ? 'Testing...' : 'Test'}
                    </button>
                    <button
                      onClick={() => handleDelete(network)}
                      className="text-xs px-3 py-1.5 border border-red-200 text-red-600 rounded-md hover:bg-red-50 transition-colors"
                    >
                      Remove
                    </button>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Connect modal */}
      {activeModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-background border rounded-lg p-6 w-full max-w-md mx-4 space-y-4">
            <h2 className="font-semibold text-lg">
              Connect {NETWORK_META[activeModal]?.label}
            </h2>
            {NETWORK_META[activeModal]?.fields.map(field => (
              <div key={field.key} className="space-y-1">
                <label className="text-sm font-medium">{field.label}</label>
                <input
                  type={field.secret ? 'password' : 'text'}
                  placeholder={field.placeholder}
                  value={formValues[field.key] ?? ''}
                  onChange={e => setFormValues(prev => ({ ...prev, [field.key]: e.target.value }))}
                  className="w-full border rounded-md px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
              </div>
            ))}
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => { setActiveModal(null); setFormValues({}); }}
                className="text-sm px-4 py-2 border rounded-md hover:bg-muted transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => handleSave(activeModal)}
                disabled={saving}
                className="text-sm px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors disabled:opacity-50"
              >
                {saving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatusPill({ connected, status }: { connected: boolean; status: NetworkStatus | null }) {
  if (!connected) {
    return (
      <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
        Not connected
      </span>
    );
  }
  if (status === 'invalid') {
    return <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">Invalid</span>;
  }
  if (status === 'rate_limited') {
    return <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400">Rate limited</span>;
  }
  return <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">Connected</span>;
}
