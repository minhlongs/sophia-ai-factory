'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/seed/components/ui/button';
import { Input } from '@/seed/components/ui/input';
import { Label } from '@/seed/components/ui/label';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/seed/components/ui/card';
import { Eye, EyeOff, ExternalLink } from 'lucide-react';
import { UseFormReturn } from 'react-hook-form';
import { UserProfileFormValues } from '@/lib/schemas/settings';

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

export function ApiKeysSection({ form, isPending, defaultValues }: ApiKeysSectionProps) {
  const t = useTranslations('settings.apiKeys');
  const { register } = form;
  const [showKeys, setShowKeys] = useState<Record<string, boolean>>({});

  const toggleKeyVisibility = (key: string) => {
    setShowKeys((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('title')}</CardTitle>
        <CardDescription>{t('subtitle')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {KEY_CONFIGS.map((config) => (
          <div key={config.id} className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor={config.id} className="text-sm font-medium">
                {config.label}
              </Label>
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
            <p className="text-xs text-muted-foreground">{t(config.descKey)}</p>
            <div className="relative">
              <Input
                id={config.id}
                type={showKeys[config.id] ? 'text' : 'password'}
                placeholder={
                  defaultValues.apiKeys[config.id] ? '********' : config.placeholder
                }
                {...register(`apiKeys.${config.id}`)}
                disabled={isPending}
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                onClick={() => toggleKeyVisibility(config.id)}
                aria-label={showKeys[config.id]
                  ? t('showAriaHide', { label: config.label })
                  : t('showAriaShow', { label: config.label })}
              >
                {showKeys[config.id] ? (
                  <EyeOff className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <Eye className="h-4 w-4 text-muted-foreground" />
                )}
              </Button>
            </div>
          </div>
        ))}

        <div className="rounded-lg bg-violet-500/5 border border-violet-500/10 px-4 py-3 mt-4">
          <p className="text-xs text-muted-foreground">
            <strong className="text-foreground">{t('securityNoteLabel')}</strong> {t('securityNoteBody')}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
