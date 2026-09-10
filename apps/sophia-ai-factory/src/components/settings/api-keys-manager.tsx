'use client';

import React, { useState, useEffect } from 'react';
import { Key, Trash2, CheckCircle, XCircle, Loader2, RefreshCw } from 'lucide-react';
import { Input } from '@/seed/components/ui/input';

interface ProviderConfig {
  id: string;
  name: string;
  hint: string;
}

const PROVIDERS: ProviderConfig[] = [
  { id: 'openrouter', name: 'OpenRouter (LLM Scripting)', hint: 'sk-or-v1-...' },
  { id: 'elevenlabs', name: 'ElevenLabs (Voice Synthesis)', hint: 'xi-api-key...' },
  { id: 'fal-ai', name: 'fal.ai (Image & Diffusion)', hint: 'key-...' },
  { id: 'd-id', name: 'D-ID (Avatar Animation)', hint: 'Basic token or email:pass' },
];

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

  const handleTestAndSave = async (providerId: string) => {
    if (!inputKey.trim()) return;
    setActionLoading(true);
    setStatusMessage(null);
    try {
      const valRes = await fetch('/api/setup-wizard/validate-key', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider: providerId, api_key: inputKey.trim() }),
      });
      const valData = (await valRes.json()) as { ok?: boolean; message?: string };
      if (!valRes.ok || !valData.ok) {
        setStatusMessage({ type: 'error', text: valData.message || 'Key validation failed.' });
        return;
      }
      const saveRes = await fetch('/api/user/byok', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider: providerId, key: inputKey.trim() }),
      });
      if (saveRes.ok) {
        setStatusMessage({ type: 'success', text: `Connected ${providerId}!` });
        setInputKey('');
        setEditingProvider(null);
        await fetchConfigured();
      } else {
        const err = (await saveRes.json()) as { error?: string };
        setStatusMessage({ type: 'error', text: err.error || 'Failed to save key' });
      }
    } catch {
      setStatusMessage({ type: 'error', text: 'Network connection failed' });
    } finally {
      setActionLoading(false);
    }
  };

  const handleRevoke = async (providerId: string) => {
    if (!confirm(`Are you sure you want to revoke the key for ${providerId}?`)) return;
    setActionLoading(true);
    try {
      const res = await fetch('/api/user/byok', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider: providerId }),
      });
      if (res.ok) {
        setStatusMessage({ type: 'success', text: `Revoked ${providerId} key.` });
        await fetchConfigured();
      }
    } catch {
      setStatusMessage({ type: 'error', text: 'Failed to revoke key' });
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <section className="bg-[#18181B] rounded-2xl p-6 shadow-xl border border-outline-variant/20">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h3 className="text-lg font-bold text-on-surface flex items-center gap-2">
            <Key className="w-5 h-5 text-primary" /> AI Provider Credentials (BYOK)
          </h3>
          <p className="text-xs text-on-surface-variant mt-0.5">
            Keys are encrypted at rest with AES-GCM-256 and never logged or exposed in plaintext.
          </p>
        </div>
      </div>

      {statusMessage && (
        <div className={`mb-4 p-3 rounded-xl text-xs font-semibold flex items-center gap-2 ${
          statusMessage.type === 'success' ? 'bg-green-500/10 text-green-400 border border-green-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'
        }`}>
          {statusMessage.type === 'success' ? <CheckCircle className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
          {statusMessage.text}
        </div>
      )}

      <div className="space-y-4">
        {PROVIDERS.map((p) => {
          const isConfigured = configuredProviders.includes(p.id);
          const isEditing = editingProvider === p.id;

          return (
            <div key={p.id} className="p-4 bg-surface-container-highest/40 rounded-xl border border-outline-variant/30">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-2.5 h-2.5 rounded-full ${isConfigured ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]' : 'bg-amber-500'}`} />
                  <div>
                    <h4 className="text-sm font-bold text-on-surface">{p.name}</h4>
                    <p className="text-xs text-on-surface-variant font-mono">
                      {isConfigured ? '••••••••••••••••••••••••••••' : p.hint}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {isConfigured && !isEditing && (
                    <button onClick={() => handleRevoke(p.id)} disabled={actionLoading} className="p-2 text-on-surface-variant hover:text-error" title="Revoke">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                  {!isEditing ? (
                    <button onClick={() => { setEditingProvider(p.id); setInputKey(''); }} className="text-xs font-semibold text-primary hover:underline px-3 py-1.5 border border-primary/30 rounded-lg hover:bg-primary/10">
                      {isConfigured ? 'Replace Key' : 'Connect'}
                    </button>
                  ) : (
                    <button onClick={() => setEditingProvider(null)} className="text-xs text-on-surface-variant hover:text-on-surface px-2">
                      Cancel
                    </button>
                  )}
                </div>
              </div>

              {isEditing && (
                <div className="mt-3 pt-3 border-t border-outline-variant/20 flex flex-col sm:flex-row gap-2">
                  <Input type="password" placeholder={`Enter ${p.name} key`} value={inputKey} onChange={(e) => setInputKey(e.target.value)} className="flex-1 bg-surface-container-lowest text-xs font-mono" />
                  <button onClick={() => handleTestAndSave(p.id)} disabled={actionLoading || !inputKey.trim()} className="bg-primary hover:bg-primary/90 text-white font-bold text-xs px-4 py-2 rounded-lg flex items-center justify-center gap-1.5 shadow-md shadow-primary/20">
                    {actionLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                    Test & Save
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
