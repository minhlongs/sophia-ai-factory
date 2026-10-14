"use client";

import { useState, useEffect, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import type { TierType } from './payment-step';
import {
  KEY_TO_PROVIDER,
  INITIAL_WIZARD_CONFIG,
  bootstrapSetupWizardState,
  type WizardKeyConfig,
} from './use-setup-wizard-helpers';

export { KEY_TO_PROVIDER };

export function useSetupWizard() {
  const t = useTranslations('setupWizard');
  const [accountEmail, setAccountEmail] = useState('');
  const [isOwner, setIsOwner] = useState(false);
  const [currentTier, setCurrentTier] = useState<TierType>('BASIC');
  const [mcuBalance, setMcuBalance] = useState<number | undefined>(undefined);
  const [subscriptionStatus, setSubscriptionStatus] = useState('PENDING');
  const [savedProviders, setSavedProviders] = useState<string[]>([]);
  const [revokingProvider, setRevokingProvider] = useState<string | null>(null);

  const [config, setConfig] = useState<WizardKeyConfig>(INITIAL_WIZARD_CONFIG);
  const [status, setStatus] = useState<Record<string, 'idle' | 'validating' | 'valid' | 'invalid'>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [latencies, setLatencies] = useState<Record<string, number>>({});
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveFailed, setSaveFailed] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    bootstrapSetupWizardState({
      setSavedProviders,
      setAccountEmail,
      setCurrentTier,
      setMcuBalance,
      setSubscriptionStatus,
      setIsOwner,
    });
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
        setConfig(INITIAL_WIZARD_CONFIG);
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
    accountEmail, isOwner, currentTier, mcuBalance, subscriptionStatus,
    savedProviders, revokingProvider, config, updateConfig, verifyKey,
    handleRevokeProvider, handleSave, status, errors, latencies,
    saveError, saveFailed, isSaving,
  };
}
