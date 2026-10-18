'use client';

import { useState, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/seed/components/ui/card';
import { ExternalLink } from 'lucide-react';
import { UseFormReturn } from 'react-hook-form';
import { UserProfileFormValues } from '@/land/schemas/settings';
import { ApiKeyInput } from '@/tree/components/setup-wizard/api-key-input';
import { KEY_CONFIGS, verifyApiKeyRequest } from './api-keys-config';

interface ApiKeysSectionProps {
  form: UseFormReturn<UserProfileFormValues>;
  isPending: boolean;
  defaultValues: UserProfileFormValues;
}

export function ApiKeysSection({ form, defaultValues }: ApiKeysSectionProps) {
  const t = useTranslations('settings.apiKeys');
  const [status, setStatus] = useState<Record<string, 'idle' | 'validating' | 'valid' | 'invalid'>>({
    openai: 'idle',
    anthropic: 'idle',
    elevenlabs: 'idle',
    heygen: 'idle',
    muapi: 'idle',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [latencies, setLatencies] = useState<Record<string, number>>({});

  const handleVerify = useCallback(async (keyId: string, keyValue: string) => {
    if (!keyValue) return;
    setStatus((prev) => ({ ...prev, [keyId]: 'validating' }));
    setErrors((prev) => ({ ...prev, [keyId]: '' }));

    try {
      const outcome = await verifyApiKeyRequest(keyId, keyValue);
      if (outcome.isValid) {
        setStatus((prev) => ({ ...prev, [keyId]: 'valid' }));
        setLatencies((prev) => ({ ...prev, [keyId]: outcome.durationMs }));
      } else {
        setStatus((prev) => ({ ...prev, [keyId]: 'invalid' }));
        setErrors((prev) => ({ ...prev, [keyId]: outcome.errorMessage || 'Verification failed' }));
      }
    } catch {
      setStatus((prev) => ({ ...prev, [keyId]: 'invalid' }));
      setErrors((prev) => ({ ...prev, [keyId]: 'Network or server error' }));
    }
  }, []);

  return (
    <Card className="bg-card dark:bg-[#11131F] border-border dark:border-white/[0.08]">
      <CardHeader>
        <CardTitle className="text-foreground dark:text-white">{t('title')}</CardTitle>
        <CardDescription>{t('subtitle')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5 font-mono">
        {KEY_CONFIGS.map((config) => {
          const keyValue = form.watch(`apiKeys.${config.id}`) ?? '';
          return (
            <div key={config.id} className="space-y-1.5 relative font-sans">
              <div className="sm:absolute sm:right-0 sm:top-0 flex items-center justify-end z-10">
                <a
                  href={config.helpUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-primary hover:text-primary/80 transition-colors"
                >
                  {t(config.helpKey)}
                  <ExternalLink className="h-3 w-3" />
                </a>
              </div>
              <ApiKeyInput
                id={config.id}
                label={config.label}
                value={keyValue}
                placeholder={
                  defaultValues.apiKeys[config.id] ? '********' : config.placeholder
                }
                onChange={(val) => {
                  form.setValue(`apiKeys.${config.id}`, val, { shouldDirty: true });
                  setStatus((prev) => ({ ...prev, [config.id]: 'idle' }));
                  setLatencies((prev) => {
                    const copy = { ...prev };
                    delete copy[config.id];
                    return copy;
                  });
                }}
                onVerify={() => handleVerify(config.id, keyValue)}
                status={status[config.id]}
                errorMessage={errors[config.id]}
                helpText={t(config.descKey)}
                latency={latencies[config.id]}
              />
            </div>
          );
        })}

        <div className="rounded-lg bg-primary/5 border border-border dark:border-white/[0.08] px-4 py-3 mt-4 font-sans">
          <p className="text-xs text-muted-foreground">
            <strong className="text-foreground dark:text-white">{t('securityNoteLabel')}</strong> {t('securityNoteBody')}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
