'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { Card, CardContent, CardHeader, CardTitle } from '@/seed/components/ui/card';
import { Button } from '@/seed/components/ui/button';
import { Input } from '@/seed/components/ui/input';
import { Key, Copy, Trash2, Check, Plus, X, AlertCircle } from 'lucide-react';

interface ApiKey {
  id: string;
  name: string;
  prefix?: string;
  created_at: string;
  last_used_at: string | null;
  revoked: boolean;
}

export function ApiKeyManager() {
  const t = useTranslations('dashboard.api_docs');
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [keyName, setKeyName] = useState('');
  const [newKeyValue, setNewKeyValue] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const loadKeys = useCallback(async () => {
    try {
      const res = await fetch('/api/v1/api-keys');
      if (!res.ok) throw new Error('Failed to load keys');
      const data = (await res.json()) as { keys?: ApiKey[] };
      setKeys(data.keys ?? []);
    } catch {
      setError('Failed to load API keys');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadKeys();
  }, [loadKeys]);

  const createKey = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!keyName.trim()) return;
    setError(null);

    try {
      const res = await fetch('/api/v1/api-keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: keyName.trim() }),
      });

      if (!res.ok) {
        const errData = (await res.json()) as { error?: string };
        throw new Error(errData.error ?? 'Failed to create key');
      }

      const createData = (await res.json()) as { key?: string; apiKey?: string };
      setNewKeyValue(createData.key ?? createData.apiKey ?? '');
      setKeyName('');
      setShowCreate(false);
      await loadKeys();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create key');
    }
  };

  const revokeKey = async (id: string) => {
    if (!confirm(t('revoke_confirm'))) return;
    setError(null);

    try {
      const res = await fetch(`/api/v1/api-keys/${id}`, { method: 'DELETE' });
      if (!res.ok && res.status !== 204) {
        const revokeErr = (await res.json()) as { error?: string };
        throw new Error(revokeErr.error ?? 'Failed to revoke key');
      }
      await loadKeys();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to revoke key');
    }
  };

  const copyToClipboard = async (value: string, id: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      // Clipboard API may fail in some contexts
    }
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return t('key_never_used');
    try {
      return new Date(dateStr).toLocaleDateString();
    } catch {
      return dateStr;
    }
  };

  if (isLoading) {
    return (
      <Card className="border-border">
        <CardContent className="pt-6">
          <div className="text-center py-8 text-muted-foreground">Loading...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-border">
      <CardHeader>
        <CardTitle className="flex items-center justify-between gap-2 text-foreground">
          <span className="flex items-center gap-2">
            <Key className="w-5 h-5" aria-hidden="true" />
            {t('api_key')}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => { setShowCreate(!showCreate); setNewKeyValue(null); }}
          >
            {showCreate ? <X className="w-4 h-4 mr-1" /> : <Plus className="w-4 h-4 mr-1" />}
            {t('create_key')}
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <div className="flex items-center gap-2 p-3 bg-destructive/10 text-destructive text-sm rounded-lg">
            <AlertCircle className="w-4 h-4" />
            {error}
          </div>
        )}

        {showCreate && (
          <form onSubmit={createKey} className="flex items-end gap-2">
            <div className="flex-1">
              <label className="text-xs text-muted-foreground mb-1 block">
                {t('create_key_name')}
              </label>
              <Input
                value={keyName}
                onChange={(e) => setKeyName(e.target.value)}
                placeholder={t('create_key_name_placeholder')}
                className="w-full"
                autoFocus
              />
            </div>
            <Button type="submit" size="sm" disabled={!keyName.trim()}>
              {t('create_key_submit')}
            </Button>
          </form>
        )}

        {newKeyValue && (
          <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg">
            <p className="text-sm font-medium text-amber-600 mb-2">
              {t('create_key_success')}
            </p>
            <div className="flex items-center gap-2">
              <code className="flex-1 px-3 py-2 bg-background rounded text-sm font-mono break-all">
                {newKeyValue}
              </code>
              <Button
                variant="outline"
                size="sm"
                onClick={() => copyToClipboard(newKeyValue, 'new')}
              >
                {copiedId === 'new' ? (
                  <Check className="w-4 h-4 text-green-500" />
                ) : (
                  <Copy className="w-4 h-4" />
                )}
              </Button>
            </div>
          </div>
        )}

        {keys.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            {t('no_keys')}
          </p>
        ) : (
          <div className="space-y-2">
            {keys.map((key) => (
              <div
                key={key.id}
                className={`flex items-center gap-3 p-3 rounded-lg ${
                  key.revoked ? 'bg-muted/30 opacity-60' : 'bg-muted/50'
                }`}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={`inline-block w-2 h-2 rounded-full ${
                      key.revoked ? 'bg-destructive' : 'bg-green-500'
                    }`} />
                    <span className="text-sm font-medium text-foreground truncate">
                      {key.name}
                    </span>
                    <span className={`text-xs px-1.5 py-0.5 rounded ${
                      key.revoked
                        ? 'bg-destructive/10 text-destructive'
                        : 'bg-green-500/10 text-green-600'
                    }`}>
                      {key.revoked ? t('key_revoked') : t('key_active')}
                    </span>
                  </div>
                  <div className="flex gap-4 mt-1 text-xs text-muted-foreground">
                    <span>{key.prefix ? `${key.prefix}...` : `${key.id.slice(0, 8)}...`}</span>
                    <span>{t('key_created')}: {formatDate(key.created_at)}</span>
                    <span>{t('key_last_used')}: {formatDate(key.last_used_at)}</span>
                  </div>
                </div>
                {!key.revoked && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => revokeKey(key.id)}
                    className="text-destructive hover:text-destructive hover:bg-destructive/10"
                    title={t('revoke_key')}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}

        <p className="text-xs text-muted-foreground">
          {t('api_key_hint')}
        </p>
      </CardContent>
    </Card>
  );
}
