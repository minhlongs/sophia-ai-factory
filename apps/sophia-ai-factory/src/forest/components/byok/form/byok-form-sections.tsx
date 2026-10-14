'use client';

// i18n-namespace: byok

import React from 'react';
import { Button } from '@/seed/components/ui/button';
import { validateProviderKey } from '@/tree/byok/key-format-validators';
import { PROVIDERS, type Provider, type TestResult } from './types';
import { ProviderCard } from './provider-card';

export async function saveByokProviderKey(
  provider: Provider,
  key: string,
): Promise<{ ok: boolean; error?: string }> {
  const res = await fetch('/api/user/byok', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ provider, key }),
  });
  if (!res.ok) {
    const err = (await res.json().catch(() => ({ error: 'Unknown error' }))) as { error?: string };
    return { ok: false, error: err.error };
  }
  return { ok: true };
}

export async function testByokProviderKey(provider: Provider): Promise<TestResult> {
  const res = await fetch('/api/user/byok/test', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ provider }),
  });
  const data = (await res.json().catch(() => ({ ok: false, error: 'Parse error' }))) as {
    ok: boolean;
    latencyMs?: number;
    status?: number;
    error?: string;
  };
  return { provider, ok: data.ok, latencyMs: data.latencyMs, error: data.error };
}

export async function deleteByokProviderKey(
  provider: Provider,
): Promise<{ ok: boolean; error?: string }> {
  const res = await fetch('/api/user/byok', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ provider }),
  });
  if (!res.ok) {
    const err = (await res.json().catch(() => ({ error: 'Unknown error' }))) as { error?: string };
    return { ok: false, error: err.error };
  }
  return { ok: true };
}

export interface ByokStatusBannerProps {
  status: string | null;
  onDismiss: () => void;
}

export function ByokStatusBanner({ status, onDismiss }: ByokStatusBannerProps) {
  if (!status) return null;
  return (
    <div className="rounded-lg bg-muted/20 border-border px-4 py-2.5 text-sm text-foreground flex items-center justify-between">
      <span>{status}</span>
      <Button variant="ghost" size="sm" onClick={onDismiss} className="text-xs">
        Dismiss
      </Button>
    </div>
  );
}

export interface ByokProviderGridProps {
  configured: Provider[];
  editingProviders: Record<Provider, boolean>;
  isPending: boolean;
  keyInputs: Record<Provider, string>;
  testResults: Record<Provider, TestResult | null>;
  testingProvider: Provider | null;
  validations: Record<Provider, ReturnType<typeof validateProviderKey>>;
  onInputChange: (p: Provider, value: string) => void;
  onToggleEditing: (p: Provider, isEditing: boolean) => void;
  onSubmit: (e: React.FormEvent, p: Provider) => void;
  onTest: (p: Provider) => void;
  onClear: (p: Provider) => void;
}

export function ByokProviderGrid({
  configured,
  editingProviders,
  isPending,
  keyInputs,
  testResults,
  testingProvider,
  validations,
  onInputChange,
  onToggleEditing,
  onSubmit,
  onTest,
  onClear,
}: ByokProviderGridProps) {
  return (
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
            onInputChange={(val) => onInputChange(p, val)}
            onToggleEditing={(edit) => onToggleEditing(p, edit)}
            onSubmit={(e) => onSubmit(e, p)}
            onTest={onTest}
            onClear={onClear}
          />
        );
      })}
    </div>
  );
}
