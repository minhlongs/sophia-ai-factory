'use client';

import { useMemo, useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/seed/components/ui/button';
import { validateProviderKey } from '@/tree/byok/key-format-validators';
import {
  PROVIDERS,
  type Provider,
  type TestResult,
  type ByokKeyFormProps,
  stripNamespace,
} from './types';
import { ProviderCard } from './provider-card';

export function ByokFormView({ configured: initialConfigured }: ByokKeyFormProps) {
  const t = useTranslations('byok');
  const [configured, setConfigured] = useState<Provider[]>(initialConfigured);
  const [status, setStatus] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [testResults, setTestResults] = useState<Record<Provider, TestResult | null>>(
    {} as Record<Provider, TestResult | null>
  );
  const [testingProvider, setTestingProvider] = useState<Provider | null>(null);
  const [keyInputs, setKeyInputs] = useState<Record<Provider, string>>(
    {} as Record<Provider, string>
  );
  const [editingProviders, setEditingProviders] = useState<Record<Provider, boolean>>(
    {} as Record<Provider, boolean>
  );

  const handleInputChange = (p: Provider, value: string) => {
    setKeyInputs((prev) => ({ ...prev, [p]: value }));
  };

  const validations = useMemo(() => {
    const results = {} as Record<Provider, ReturnType<typeof validateProviderKey>>;
    PROVIDERS.forEach(({ value: p }) => {
      results[p] = validateProviderKey(p, keyInputs[p] || '');
    });
    return results;
  }, [keyInputs]);

  const toggleEditing = (p: Provider, isEditing: boolean) => {
    setEditingProviders((prev) => ({ ...prev, [p]: isEditing }));
    if (!isEditing) {
      setKeyInputs((prev) => ({ ...prev, [p]: '' }));
    }
  };

  function handleSingleSubmit(e: React.FormEvent, p: Provider) {
    e.preventDefault();
    const validation = validations[p];
    const keyValue = keyInputs[p] || '';

    if (!validation.ok) {
      setStatus(validation.errorKey ? t(stripNamespace(validation.errorKey)) : t('error_format'));
      return;
    }

    const submitKey = validation.autoEncoded ?? keyValue.trim();

    startTransition(async () => {
      setStatus(null);
      try {
        const res = await fetch('/api/user/byok', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ provider: p, key: submitKey }),
        });
        if (!res.ok) {
          const err = (await res.json().catch(() => ({ error: 'Unknown error' }))) as { error?: string };
          setStatus(err.error ?? t('error_format'));
          return;
        }
        setConfigured((prev) => (prev.includes(p) ? prev : [...prev, p]));
        setKeyInputs((prev) => ({ ...prev, [p]: '' }));
        setEditingProviders((prev) => ({ ...prev, [p]: false }));
        setStatus(t('saved', { provider: p }));
        handleTest(p);
      } catch {
        setStatus(t('network_error'));
      }
    });
  }

  async function handleTest(p: Provider) {
    setTestingProvider(p);
    try {
      const res = await fetch('/api/user/byok/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider: p }),
      });
      const data = (await res.json().catch(() => ({ ok: false, error: 'Parse error' }))) as {
        ok: boolean;
        latencyMs?: number;
        status?: number;
        error?: string;
      };
      setTestResults((prev) => ({
        ...prev,
        [p]: { provider: p, ok: data.ok, latencyMs: data.latencyMs, error: data.error },
      }));
    } catch (err) {
      setTestResults((prev) => ({
        ...prev,
        [p]: { provider: p, ok: false, error: err instanceof Error ? err.message : t('network_error') },
      }));
    } finally {
      setTestingProvider(null);
    }
  }

  function handleClear(p: Provider) {
    const label = PROVIDERS.find((x) => x.value === p)?.label ?? p;
    const confirmed = window.confirm(t('clear_confirm', { label }));
    if (!confirmed) return;

    startTransition(async () => {
      setStatus(null);
      try {
        const res = await fetch('/api/user/byok', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ provider: p }),
        });
        if (!res.ok) {
          const err = (await res.json().catch(() => ({ error: 'Unknown error' }))) as { error?: string };
          setStatus(err.error ?? t('error_format'));
          return;
        }
        setConfigured((prev) => prev.filter((x) => x !== p));
        setTestResults((prev) => ({ ...prev, [p]: null }));
        setStatus(t('cleared', { provider: p }));
      } catch {
        setStatus(t('network_error'));
      }
    });
  }

  return (
    <div className="space-y-6">
      {status && (
        <div className="rounded-lg bg-muted/20 border-border px-4 py-2.5 text-sm text-foreground flex items-center justify-between">
          <span>{status}</span>
          <Button variant="ghost" size="sm" onClick={() => setStatus(null)} className="text-xs">
            Dismiss
          </Button>
        </div>
      )}

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {PROVIDERS.map((pInfo) => {
          const p = pInfo.value;
          const isConfigured = configured.includes(p);
          const isEditing = editingProviders[p] || !isConfigured;

          return (
            <ProviderCard
              key={p}
              providerInfo={pInfo}
              isConfigured={isConfigured}
              isEditing={isEditing}
              isPending={isPending}
              keyValue={keyInputs[p] || ''}
              testResult={testResults[p] || null}
              testingProvider={testingProvider}
              validation={validations[p]}
              onInputChange={(val) => handleInputChange(p, val)}
              onToggleEditing={(edit) => toggleEditing(p, edit)}
              onSubmit={(e) => handleSingleSubmit(e, p)}
              onTest={handleTest}
              onClear={handleClear}
            />
          );
        })}
      </div>
    </div>
  );
}
