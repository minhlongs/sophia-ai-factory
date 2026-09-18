"use client";

import { useState, useEffect, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import type { TierType } from './payment-step';

export const KEY_TO_PROVIDER: Record<string, string> = {
  OPENROUTER_API_KEY: 'openrouter',
  ANTHROPIC_API_KEY: 'anthropic',
  ELEVENLABS_API_KEY: 'elevenlabs',
  DID_API_KEY: 'd-id',
  MUAPI_API_KEY: 'muapi',
  REPLICATE_API_KEY: 'replicate',
  FAL_API_KEY: 'fal-ai',
};

export function useSetupWizard() {
  const t = useTranslations('setupWizard');
  const [accountEmail, setAccountEmail] = useState('');
  const [isOwner, setIsOwner] = useState(false);
  const [currentTier, setCurrentTier] = useState<TierType>('BASIC');
  const [mcuBalance, setMcuBalance] = useState<number | undefined>(undefined);
  const [subscriptionStatus, setSubscriptionStatus] = useState('PENDING');
  const [savedProviders, setSavedProviders] = useState<string[]>([]);
  const [revokingProvider, setRevokingProvider] = useState<string | null>(null);

  const [config, setConfig] = useState({
    OPENROUTER_API_KEY: '',
    ANTHROPIC_API_KEY: '',
    ELEVENLABS_API_KEY: '',
    DID_API_KEY: '',
    MUAPI_API_KEY: '',
    REPLICATE_API_KEY: '',
    FAL_API_KEY: '',
  });
  const [status, setStatus] = useState<Record<string, 'idle' | 'validating' | 'valid' | 'invalid'>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [latencies, setLatencies] = useState<Record<string, number>>({});
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveFailed, setSaveFailed] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    fetch('/api/user/byok')
      .then(async (res) => (res.ok ? (await res.json() as { providers?: string[] }) : null))
      .then((d) => {
        if (d?.providers) setSavedProviders(d.providers);
      })
      .catch(() => {});

    fetch('/api/user/profile')
      .then(async (res) => (res.ok ? (await res.json() as { email?: string }) : null))
      .then((d) => {
        if (d?.email) setAccountEmail(d.email);
      })
      .catch(() => {});

    fetch('/api/setup-wizard/readiness')
      .then(async (res) => (res.ok ? (await res.json() as { tier?: string; mcuBalance?: number; subscriptionActive?: boolean; ownerVerified?: boolean }) : null))
      .then((d) => {
        if (d) {
          if (d.tier) setCurrentTier((d.tier.toUpperCase() as TierType) || 'PREMIUM');
          if (typeof d.mcuBalance === 'number') setMcuBalance(d.mcuBalance);
          if (d.subscriptionActive) setSubscriptionStatus('ACTIVE');
          if (typeof d.ownerVerified === 'boolean') setIsOwner(d.ownerVerified);
        }
      })
      .catch(() => {});
  }, []);

  const updateConfig = useCallback((key: string, value: string) => {
    setConfig(prev => ({ ...prev, [key]: value }));
  }, []);

  const verifyKey = useCallback(async (service: string, keyName: string, keyValue: string) => {
    if (!keyValue.trim()) {
      setStatus(prev => ({ ...prev, [keyName]: 'invalid' }));
      setErrors(prev => ({ ...prev, [keyName]: t('errors.emptyKey') }));
      return false;
    }
    setStatus(prev => ({ ...prev, [keyName]: 'validating' }));
    setErrors(prev => ({ ...prev, [keyName]: '' }));
    try {
      const start = Date.now();
      const res = await fetch('/api/setup-wizard/validate-key', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider: service, api_key: keyValue }),
      });
      const data = await res.json() as { valid?: boolean; message?: string; message_vi?: string; latencyMs?: number };
      const latency = data.latencyMs ?? (Date.now() - start);
      if (res.ok && data.valid) {
        setStatus(prev => ({ ...prev, [keyName]: 'valid' }));
        setLatencies(prev => ({ ...prev, [keyName]: latency }));
        return true;
      }
      const errMsg = data.message_vi || data.message || t('errors.verificationFailed');
      setStatus(prev => ({ ...prev, [keyName]: 'invalid' }));
      setErrors(prev => ({ ...prev, [keyName]: errMsg }));
      setLatencies(prev => ({ ...prev, [keyName]: latency }));
      return false;
    } catch {
      setStatus(prev => ({ ...prev, [keyName]: 'invalid' }));
      setErrors(prev => ({ ...prev, [keyName]: t('errors.verificationFailed') }));
      return false;
    }
  }, [t]);

  const handleRevokeProvider = useCallback(async (provider: string, keyName: string) => {
    setRevokingProvider(provider);
    try {
      const res = await fetch('/api/user/byok', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider }),
      });
      if (res.ok) {
        setSavedProviders(prev => prev.filter(p => p !== provider));
        setConfig(prev => ({ ...prev, [keyName]: '' }));
        setStatus(prev => ({ ...prev, [keyName]: 'idle' }));
      }
    } finally {
      setRevokingProvider(null);
    }
  }, []);

  const handleSave = useCallback(async (): Promise<boolean> => {
    setSaveError(null);
    setSaveFailed(false);
    setIsSaving(true);
    try {
      const entries = Object.entries(config).filter(([k, v]) => KEY_TO_PROVIDER[k] && v.trim());
      const newlySaved: string[] = [];

      // Enforce live ping verification on all pending keys before persisting to D1
      for (const [k, v] of entries) {
        const provider = KEY_TO_PROVIDER[k];
        if (status[k] !== 'valid') {
          const isValid = await verifyKey(provider, k, v);
          if (!isValid) {
            throw new Error(`Xác thực ${provider} không thành công / Verification for ${provider} failed. Please verify API key with upstream provider.`);
          }
        }
      }

      for (const [k, v] of entries) {
        const provider = KEY_TO_PROVIDER[k];
        const res = await fetch('/api/user/byok', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ provider, key: v }),
        });
        if (!res.ok) {
          const d = await res.json() as { error?: string };
          throw new Error(d.error || t('errors.saveFailed'));
        }
        newlySaved.push(provider);
      }
      if (newlySaved.length > 0) {
        setSavedProviders(prev => Array.from(new Set([...prev, ...newlySaved])));
        // NEVER display the key after save — wipe raw keys from client state
        setConfig({
          OPENROUTER_API_KEY: '',
          ANTHROPIC_API_KEY: '',
          ELEVENLABS_API_KEY: '',
          DID_API_KEY: '',
          MUAPI_API_KEY: '',
          REPLICATE_API_KEY: '',
          FAL_API_KEY: '',
        });
      }
      return true;
    } catch (e) {
      const msg = e instanceof Error ? e.message : t('errors.saveFailed');
      setSaveError(msg);
      setSaveFailed(true);
      return false;
    } finally {
      setIsSaving(false);
    }
  }, [t, config, status, verifyKey]);

  return {
    accountEmail,
    isOwner,
    currentTier,
    mcuBalance,
    subscriptionStatus,
    savedProviders,
    revokingProvider,
    config,
    updateConfig,
    verifyKey,
    handleRevokeProvider,
    handleSave,
    status,
    errors,
    latencies,
    saveError,
    saveFailed,
    isSaving,
  };
}
