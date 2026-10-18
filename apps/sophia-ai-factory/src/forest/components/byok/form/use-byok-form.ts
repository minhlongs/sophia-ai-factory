'use client';

import { useMemo, useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { validateProviderKey } from '@/tree/byok/key-format-validators';
import {
  PROVIDERS,
  type Provider,
  type TestResult,
  stripNamespace,
} from './types';
import {
  saveByokProviderKey,
  testByokProviderKey,
  deleteByokProviderKey,
} from './byok-form-sections';

export function useByokForm(initialConfigured: Provider[]) {
  const t = useTranslations('byok');
  const [configured, setConfigured] = useState<Provider[]>(initialConfigured);
  const [status, setStatus] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [testResults, setTestResults] = useState<Record<Provider, TestResult | null>>(
    {} as Record<Provider, TestResult | null>,
  );
  const [testingProvider, setTestingProvider] = useState<Provider | null>(null);
  const [keyInputs, setKeyInputs] = useState<Record<Provider, string>>({} as Record<Provider, string>);
  const [editingProviders, setEditingProviders] = useState<Record<Provider, boolean>>(
    {} as Record<Provider, boolean>,
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
    if (!isEditing) setKeyInputs((prev) => ({ ...prev, [p]: '' }));
  };

  async function handleTest(p: Provider) {
    setTestingProvider(p);
    try {
      const result = await testByokProviderKey(p);
      setTestResults((prev) => ({ ...prev, [p]: result }));
    } catch (err) {
      const error = err instanceof Error ? err.message : t('network_error');
      setTestResults((prev) => ({ ...prev, [p]: { provider: p, ok: false, error } }));
    } finally {
      setTestingProvider(null);
    }
  }

  function handleSingleSubmit(e: React.FormEvent, p: Provider) {
    e.preventDefault();
    const validation = validations[p];
    if (!validation.ok) {
      setStatus(validation.errorKey ? t(stripNamespace(validation.errorKey)) : t('error_format'));
      return;
    }
    const submitKey = validation.autoEncoded ?? (keyInputs[p] || '').trim();
    startTransition(async () => {
      setStatus(null);
      try {
        const res = await saveByokProviderKey(p, submitKey);
        if (!res.ok) return setStatus(res.error ?? t('error_format'));
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

  function handleClear(p: Provider) {
    const label = PROVIDERS.find((x) => x.value === p)?.label ?? p;
    if (!window.confirm(t('clear_confirm', { label }))) return;
    startTransition(async () => {
      setStatus(null);
      try {
        const res = await deleteByokProviderKey(p);
        if (!res.ok) return setStatus(res.error ?? t('error_format'));
        setConfigured((prev) => prev.filter((x) => x !== p));
        setTestResults((prev) => ({ ...prev, [p]: null }));
        setStatus(t('cleared', { provider: p }));
      } catch {
        setStatus(t('network_error'));
      }
    });
  }

  return {
    configured,
    status,
    setStatus,
    isPending,
    testResults,
    testingProvider,
    keyInputs,
    editingProviders,
    validations,
    handleInputChange,
    toggleEditing,
    handleTest,
    handleSingleSubmit,
    handleClear,
  };
}
