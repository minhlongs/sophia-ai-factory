// i18n-namespace: byok.picker
'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  PROVIDER_LABELS,
  PROVIDER_MODELS,
  PICKABLE_PROVIDERS,
  type ByokConfiguredResponse,
  type ByokProviderId,
  type ByokProviderPickerProps,
} from './types';
import { ProviderModalTrigger } from './provider-modal-trigger';
import { ProviderCard } from './provider-card';

export function ByokProviderPicker({ onSelect, value, className = '' }: ByokProviderPickerProps) {
  const t = useTranslations('byok.picker');
  const [configured, setConfigured] = useState<ByokProviderId[]>([]);
  const [loadingProviders, setLoadingProviders] = useState(true);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    fetch('/api/user/byok')
      .then(r => r.json() as Promise<ByokConfiguredResponse | string[]>)
      .then(d => {
        const list: string[] = Array.isArray(d) ? d : ((d as ByokConfiguredResponse).configured ?? []);
        const pickable = list.filter((p): p is ByokProviderId =>
          PICKABLE_PROVIDERS.includes(p as ByokProviderId)
        );
        setConfigured(pickable);
      })
      .catch(() => setConfigured([]))
      .finally(() => setLoadingProviders(false));
  }, []);

  if (loadingProviders) {
    return (
      <div className={`h-9 bg-muted animate-pulse rounded-md ${className}`} aria-busy="true" />
    );
  }

  if (configured.length === 0) {
    return (
      <p className={`text-xs text-muted-foreground ${className}`}>
        {t('no_providers')}
      </p>
    );
  }

  const selectedProviderModels = value ? PROVIDER_MODELS[value.providerId] ?? [] : [];
  const selectedModel = selectedProviderModels.find(m => m.modelId === value?.modelId);

  const handleSelectModel = (providerId: ByokProviderId, modelId: string) => {
    onSelect({ providerId, modelId });
    setOpen(false);
  };

  const handleClear = () => {
    onSelect(null);
    setOpen(false);
  };

  return (
    <div className={`relative ${className}`}>
      <ProviderModalTrigger
        open={open}
        value={value}
        selectedModel={selectedModel}
        onToggle={() => setOpen(o => !o)}
      />

      {open && (
        <div
          role="listbox"
          aria-label={t('aria_label')}
          className="absolute z-20 mt-1 w-full rounded-lg border border-border bg-card shadow-lg overflow-hidden"
        >
          <button
            type="button"
            role="option"
            aria-selected={!value}
            onClick={handleClear}
            className="w-full px-3 py-2 text-left text-xs text-muted-foreground hover:bg-muted"
          >
            {t('system_default')}
          </button>

          {configured.map(providerId => (
            <div key={providerId}>
              <div className="px-3 pt-2 pb-1 text-xs font-semibold text-muted-foreground uppercase tracking-wide border-t border-border">
                {PROVIDER_LABELS[providerId]}
              </div>
              {(PROVIDER_MODELS[providerId] ?? []).map(model => (
                <ProviderCard
                  key={model.modelId}
                  providerId={providerId}
                  model={model}
                  value={value}
                  onSelect={handleSelectModel}
                />
              ))}
            </div>
          ))}
        </div>
      )}

      {value && selectedModel && (
        <p className="mt-1 text-xs text-muted-foreground">
          {t('cost_preview', {
            input: selectedModel.inputPer1k,
            output: selectedModel.outputPer1k,
          })}
        </p>
      )}
    </div>
  );
}
