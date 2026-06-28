'use client';

/**
 * BYOK Provider Picker
 *
 * Dropdown for selecting a configured BYOK provider + model pair with cost preview.
 * Fetches user's configured providers from GET /api/user/byok, then shows a model
 * list per provider. Emits onSelect({ providerId, modelId }) when user picks.
 *
 * YAGNI: model list is hardcoded per provider — no dynamic model-fetch needed.
 * Usage: wire into MissionLauncher or any mission creation form as optional field.
 */

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { ChevronDown } from 'lucide-react';

// ── Provider + model catalogue ──────────────────────────────────────────────

export type ByokProviderId = 'anthropic' | 'openrouter';

export interface ByokModelOption {
  modelId: string;
  label: string;
  /** Input cost in USD per 1k tokens */
  inputPer1k: number;
  /** Output cost in USD per 1k tokens */
  outputPer1k: number;
}

const PROVIDER_MODELS: Record<ByokProviderId, ByokModelOption[]> = {
  anthropic: [
    { modelId: 'claude-opus-4-7',    label: 'Claude Opus 4.7',   inputPer1k: 0.015, outputPer1k: 0.075 },
    { modelId: 'claude-sonnet-4-6',  label: 'Claude Sonnet 4.6', inputPer1k: 0.003, outputPer1k: 0.015 },
    { modelId: 'claude-haiku-3-5',   label: 'Claude Haiku 3.5',  inputPer1k: 0.0008, outputPer1k: 0.004 },
  ],
  openrouter: [
    { modelId: 'openai/gpt-4o',           label: 'GPT-4o (via OpenRouter)',       inputPer1k: 0.005, outputPer1k: 0.015 },
    { modelId: 'anthropic/claude-sonnet',  label: 'Claude Sonnet (via OpenRouter)', inputPer1k: 0.003, outputPer1k: 0.015 },
    { modelId: 'meta-llama/llama-3.1-8b', label: 'Llama 3.1 8B (via OpenRouter)',  inputPer1k: 0.0001, outputPer1k: 0.0001 },
  ],
};

const PROVIDER_LABELS: Record<ByokProviderId, string> = {
  anthropic:  'Anthropic',
  openrouter: 'OpenRouter',
};

// Providers user can configure that also have model options in this picker
const PICKABLE_PROVIDERS: ByokProviderId[] = ['anthropic', 'openrouter'];

// ── Types ───────────────────────────────────────────────────────────────────

export interface ByokSelection {
  providerId: ByokProviderId;
  modelId: string;
}

interface ByokConfiguredResponse {
  configured?: string[];
}

interface Props {
  /** Called when user selects a provider+model pair */
  onSelect: (selection: ByokSelection | null) => void;
  /** Currently selected value (controlled) */
  value?: ByokSelection | null;
  /** Additional container class */
  className?: string;
}

// ── Component ───────────────────────────────────────────────────────────────

export function ByokProviderPicker({ onSelect, value, className = '' }: Props) {
  const t = useTranslations('byok.picker');
  const [configured, setConfigured] = useState<ByokProviderId[]>([]);
  const [loadingProviders, setLoadingProviders] = useState(true);
  const [open, setOpen] = useState(false);

  // Fetch user's configured providers once on mount
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

  const selectedProviderModels = value
    ? PROVIDER_MODELS[value.providerId] ?? []
    : [];
  const selectedModel = selectedProviderModels.find(m => m.modelId === value?.modelId);

  function handleSelectProvider(providerId: ByokProviderId) {
    const firstModel = PROVIDER_MODELS[providerId]?.[0];
    if (firstModel) {
      onSelect({ providerId, modelId: firstModel.modelId });
    }
    setOpen(false);
  }

  function handleSelectModel(modelId: string) {
    if (!value) return;
    onSelect({ ...value, modelId });
    setOpen(false);
  }

  function handleClear() {
    onSelect(null);
    setOpen(false);
  }

  return (
    <div className={`relative ${className}`}>
      {/* Trigger button */}
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen(o => !o)}
        className="flex w-full items-center justify-between gap-2 rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground hover:border-primary/60 focus:outline-none focus:ring-2 focus:ring-primary"
      >
        <span className="truncate">
          {value
            ? `${PROVIDER_LABELS[value.providerId]} / ${selectedModel?.label ?? value.modelId}`
            : t('placeholder')}
        </span>
        <ChevronDown className="h-4 w-4 text-muted-foreground flex-shrink-0" aria-hidden="true" />
      </button>

      {/* Dropdown panel */}
      {open && (
        <div
          role="listbox"
          aria-label={t('aria_label')}
          className="absolute z-20 mt-1 w-full rounded-lg border border-border bg-card shadow-lg overflow-hidden"
        >
          {/* "No model / use system" option */}
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
              {/* Provider heading */}
              <div className="px-3 pt-2 pb-1 text-xs font-semibold text-muted-foreground uppercase tracking-wide border-t border-border">
                {PROVIDER_LABELS[providerId]}
              </div>
              {/* Model options */}
              {(PROVIDER_MODELS[providerId] ?? []).map(model => {
                const isSelected = value?.providerId === providerId && value.modelId === model.modelId;
                return (
                  <button
                    key={model.modelId}
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    onClick={() => {
                      if (value?.providerId !== providerId) {
                        handleSelectProvider(providerId);
                        // Override with specific model
                        onSelect({ providerId, modelId: model.modelId });
                        setOpen(false);
                      } else {
                        handleSelectModel(model.modelId);
                      }
                    }}
                    className={`flex w-full items-center justify-between px-3 py-1.5 text-left text-sm hover:bg-muted ${
                      isSelected ? 'bg-primary/10 text-primary font-medium' : 'text-foreground'
                    }`}
                  >
                    <span>{model.label}</span>
                    <span className="text-xs text-muted-foreground whitespace-nowrap ml-3">
                      ${model.inputPer1k}/${model.outputPer1k} /1k
                    </span>
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      )}

      {/* Cost preview for selected model */}
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
