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
import {
  requestKeyValidation,
  requestProviderRevoke,
  validateAndSaveConfiguredKeys,
} from './use-setup-wizard-actions';

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
      setSavedProviders, setAccountEmail, setCurrentTier,
      setMcuBalance, setSubscriptionStatus, setIsOwner,
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
      const result = await requestKeyValidation(service, keyValue, t('errors.verificationFailed'));
      setLatencies(prev => ({ ...prev, [keyName]: result.latencyMs }));
      if (result.valid) {
        setStatus(prev => ({ ...prev, [keyName]: 'valid' }));
        return true;
      }
      setStatus(prev => ({ ...prev, [keyName]: 'invalid' }));
      setErrors(prev => ({ ...prev, [keyName]: result.errorMessage || t('errors.verificationFailed') }));
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
      const ok = await requestProviderRevoke(provider);
      if (ok) {
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
      const newlySaved = await validateAndSaveConfiguredKeys({
        config, status, verifyKey, saveFailedFallback: t('errors.saveFailed'),
      });
      if (newlySaved.length > 0) {
        setSavedProviders(prev => Array.from(new Set([...prev, ...newlySaved])));
        setConfig(INITIAL_WIZARD_CONFIG);
      }
      return true;
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : t('errors.saveFailed'));
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
