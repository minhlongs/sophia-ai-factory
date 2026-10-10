'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/seed/components/ui/button';
import { ByokHelpTip } from '@/components/onboarding/byok-help-tip';
import type { Provider, ProviderInfo } from './types';
import { stripNamespace } from './types';
import type { validateProviderKey } from '@/tree/byok/key-format-validators';

interface KeyInputFormProps {
  providerInfo: ProviderInfo;
  keyValue: string;
  isPending: boolean;
  isConfigured: boolean;
  validation: ReturnType<typeof validateProviderKey>;
  onInputChange: (value: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  onCancel: () => void;
}

export function KeyInputForm({
  providerInfo,
  keyValue,
  isPending,
  isConfigured,
  validation,
  onInputChange,
  onSubmit,
  onCancel,
}: KeyInputFormProps) {
  const t = useTranslations('byok');
  const p = providerInfo.value;

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <div className="space-y-1">
        <label
          htmlFor={`byok-key-${p}`}
          className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider"
        >
          API Key
        </label>
        <input
          id={`byok-key-${p}`}
          type="password"
          autoComplete="off"
          value={keyValue}
          onChange={(e) => onInputChange(e.target.value)}
          placeholder={providerInfo.hint}
          disabled={isPending}
          aria-invalid={keyValue?.trim() && !validation?.ok ? true : undefined}
          aria-describedby={keyValue?.trim() && !validation?.ok ? `byok-error-${p}` : undefined}
          className="w-full rounded-lg border-border bg-background px-3 py-1.5 text-xs text-foreground font-mono placeholder:text-muted-foreground focus:outline-none focus:border-primary-500/50"
        />
        {keyValue?.trim() && !validation?.ok && validation?.errorKey && (
          <p id={`byok-error-${p}`} className="text-xs text-rose-400 mt-1" role="alert">
            {t(stripNamespace(validation.errorKey))}
          </p>
        )}
        {validation?.ok && validation?.autoEncoded && (
          <p className="text-xs text-amber-400 mt-1">
            {t('validate.did.auto_encoded')}
          </p>
        )}
        {(p === 'openrouter' || p === 'elevenlabs' || p === 'd-id') && (
          <div className="pt-1">
            <ByokHelpTip provider={p} />
          </div>
        )}
      </div>
      <div className="flex gap-2">
        <Button
          type="submit"
          size="sm"
          disabled={isPending || !validation?.ok}
          className="flex-1"
        >
          {isPending ? 'Saving...' : 'Save Key'}
        </Button>
        {isConfigured && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onCancel}
            className="flex-1"
          >
            Cancel
          </Button>
        )}
      </div>
    </form>
  );
}
