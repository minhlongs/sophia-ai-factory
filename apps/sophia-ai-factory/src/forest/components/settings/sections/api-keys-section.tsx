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

interface ApiKeysSectionProps {
  form: UseFormReturn<UserProfileFormValues>;
  isPending: boolean;
  defaultValues: UserProfileFormValues;
}

interface KeyConfig {
  id: keyof UserProfileFormValues['apiKeys'];
  label: string;
  descKey: string;
  helpKey: string;
  placeholder: string;
  helpUrl: string;
}

const KEY_CONFIGS: KeyConfig[] = [
  { id: 'openai',     label: 'OpenAI / OpenRouter', descKey: 'openaiDesc',     helpKey: 'openaiHelp',     placeholder: 'sk-...',     helpUrl: 'https://openrouter.ai/keys' },
  { id: 'anthropic',  label: 'Anthropic (Claude)',  descKey: 'anthropicDesc',  helpKey: 'anthropicHelp',  placeholder: 'sk-ant-...', helpUrl: 'https://console.anthropic.com/settings/keys' },
  { id: 'elevenlabs', label: 'ElevenLabs',           descKey: 'elevenlabsDesc', helpKey: 'elevenlabsHelp', placeholder: 'xi-...',     helpUrl: 'https://elevenlabs.io/subscription' },
  { id: 'heygen',     label: 'HeyGen',               descKey: 'heygenDesc',     helpKey: 'heygenHelp',     placeholder: 'hg-...',     helpUrl: 'https://app.heygen.com/settings/api-keys' },
  { id: 'muapi',      label: 'MuAPI (Media AI)',     descKey: 'muapiDesc',      helpKey: 'muapiHelp',      placeholder: 'mu-...',     helpUrl: 'https://muapi.ai/dashboard' },
];

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
    const startTime = performance.now();

    try {
      let res;
      if (keyId === 'heygen') {
        res = await fetch('/api/setup-wizard/test-heygen', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ api_key: keyValue }),
        });
      } else {
        const service = keyId === 'openai' ? 'openrouter' : keyId;
        res = await fetch('/api/setup/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ service, key: keyValue }),
        });
      }

      const endTime = performance.now();
      const duration = Math.round(endTime - startTime);

      const data = (await res.json()) as { valid?: boolean; ok?: boolean; message?: string };
      const isValid = data.valid === true || data.ok === true;

      if (isValid) {
        setStatus((prev) => ({ ...prev, [keyId]: 'valid' }));
        setLatencies((prev) => ({ ...prev, [keyId]: duration }));
      } else {
        setStatus((prev) => ({ ...prev, [keyId]: 'invalid' }));
        setErrors((prev) => ({ ...prev, [keyId]: data.message || 'Verification failed' }));
      }
    } catch {
      setStatus((prev) => ({ ...prev, [keyId]: 'invalid' }));
      setErrors((prev) => ({ ...prev, [keyId]: 'Network or server error' }));
    }
  }, []);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('title')}</CardTitle>
        <CardDescription>{t('subtitle')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {KEY_CONFIGS.map((config) => {
          const keyValue = form.watch(`apiKeys.${config.id}`) ?? '';
          return (
            <div key={config.id} className="space-y-1.5 relative">
              <div className="absolute right-0 top-0 flex items-center justify-end z-10">
                <a
                  href={config.helpUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-violet-400 hover:text-violet-300 transition-colors"
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

        <div className="rounded-lg bg-violet-500/5 border border-violet-500/10 px-4 py-3 mt-4">
          <p className="text-xs text-muted-foreground">
            <strong className="text-foreground">{t('securityNoteLabel')}</strong> {t('securityNoteBody')}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
