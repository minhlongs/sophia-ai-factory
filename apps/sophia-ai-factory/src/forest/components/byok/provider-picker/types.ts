// i18n-namespace: byok.picker

export type ByokProviderId = 'anthropic' | 'openrouter';

export interface ByokModelOption {
  modelId: string;
  label: string;
  /** Input cost in USD per 1k tokens */
  inputPer1k: number;
  /** Output cost in USD per 1k tokens */
  outputPer1k: number;
}

export interface ByokSelection {
  providerId: ByokProviderId;
  modelId: string;
}

export interface ByokConfiguredResponse {
  configured?: string[];
}

export interface ByokProviderPickerProps {
  /** Called when user selects a provider+model pair */
  onSelect: (selection: ByokSelection | null) => void;
  /** Currently selected value (controlled) */
  value?: ByokSelection | null;
  /** Additional container class */
  className?: string;
}

export const PROVIDER_MODELS: Record<ByokProviderId, ByokModelOption[]> = {
  anthropic: [
    { modelId: 'claude-opus-4-7', label: 'Claude Opus 4.7', inputPer1k: 0.015, outputPer1k: 0.075 },
    { modelId: 'claude-sonnet-4-6', label: 'Claude Sonnet 4.6', inputPer1k: 0.003, outputPer1k: 0.015 },
    { modelId: 'claude-haiku-3-5', label: 'Claude Haiku 3.5', inputPer1k: 0.0008, outputPer1k: 0.004 },
  ],
  openrouter: [
    { modelId: 'openai/gpt-4o', label: 'GPT-4o (via OpenRouter)', inputPer1k: 0.005, outputPer1k: 0.015 },
    { modelId: 'anthropic/claude-sonnet', label: 'Claude Sonnet (via OpenRouter)', inputPer1k: 0.003, outputPer1k: 0.015 },
    { modelId: 'meta-llama/llama-3.1-8b', label: 'Llama 3.1 8B (via OpenRouter)', inputPer1k: 0.0001, outputPer1k: 0.0001 },
  ],
};

export const PROVIDER_LABELS: Record<ByokProviderId, string> = {
  anthropic: 'Anthropic',
  openrouter: 'OpenRouter',
};

export const PICKABLE_PROVIDERS: ByokProviderId[] = ['anthropic', 'openrouter'];
