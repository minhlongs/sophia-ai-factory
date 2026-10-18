'use client';

import React, { useState, useEffect } from 'react';
import { Key, CheckCircle, XCircle } from 'lucide-react';
import { PROVIDERS, ProviderKeyCard } from './provider-key-card';
import { handleTestAndSave, handleRevoke } from './api-keys-manager-handlers';

export { PROVIDERS, ProviderKeyCard, type ProviderConfig, type ProviderKeyCardProps } from './provider-key-card';

export function ApiKeysManager() {
  const [configuredProviders, setConfiguredProviders] = useState<string[]>([]);
  const [editingProvider, setEditingProvider] = useState<string | null>(null);
  const [inputKey, setInputKey] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const fetchConfigured = async () => {
    try {
      const res = await fetch('/api/user/byok');
      if (res.ok) {
        const data = (await res.json()) as { providers: string[] };
        setConfiguredProviders(data.providers || []);
      }
    } catch {
      // Graceful fallback
    }
  };

  useEffect(() => {
    void fetchConfigured();
  }, []);

  const handleTestAndSaveWrapper = async (providerId: string) => {
    setActionLoading(true);
    setStatusMessage(null);
    const result = await handleTestAndSave(providerId, inputKey);
    if (result.ok) {
      setStatusMessage({ type: 'success', text: result.message || `Connected ${providerId}!` });
      setInputKey('');
      setEditingProvider(null);
      await fetchConfigured();
    } else {
      setStatusMessage({ type: 'error', text: result.message || 'Failed to save key' });
    }
    setActionLoading(false);
  };

  const handleRevokeWrapper = async (providerId: string) => {
    setActionLoading(true);
    const result = await handleRevoke(providerId);
    if (result.ok) {
      setStatusMessage({ type: 'success', text: result.message || `Revoked ${providerId} key.` });
      await fetchConfigured();
    } else {
      setStatusMessage({ type: 'error', text: result.message || 'Failed to revoke key' });
    }
    setActionLoading(false);
  };

  return (
    <section className="bg-card dark:bg-[#11131F] rounded-2xl p-6 shadow-sm border border-border dark:border-white/[0.08]">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h3 className="text-lg font-bold text-foreground dark:text-white flex items-center gap-2">
            <Key className="w-5 h-5 text-primary" /> AI Provider Credentials (BYOK)
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Keys are encrypted at rest with AES-GCM-256 and never logged or exposed in plaintext.
          </p>
        </div>
      </div>

      {statusMessage && (
        <div className={`mb-4 p-3 rounded-xl text-xs font-semibold flex items-center gap-2 ${
          statusMessage.type === 'success' ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20' : 'bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20'
        }`}>
          {statusMessage.type === 'success' ? <CheckCircle className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
          {statusMessage.text}
        </div>
      )}

      <div className="space-y-4">
        {PROVIDERS.map((p) => (
          <ProviderKeyCard
            key={p.id}
            provider={p}
            isConfigured={configuredProviders.includes(p.id)}
            isEditing={editingProvider === p.id}
            inputKey={inputKey}
            actionLoading={actionLoading}
            onStartEdit={(id) => {
              setEditingProvider(id);
              setInputKey('');
            }}
            onCancelEdit={() => setEditingProvider(null)}
            onInputKeyChange={setInputKey}
            onTestAndSave={handleTestAndSaveWrapper}
            onRevoke={handleRevokeWrapper}
          />
        ))}
      </div>
    </section>
  );
}