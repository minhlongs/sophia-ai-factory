import { Globe, Bot, Volume2, Video, Layers, Search, Mail } from 'lucide-react';

export type UserSettableProvider = 'openrouter' | 'anthropic' | 'elevenlabs' | 'd-id' | 'muapi' | 'apollo' | 'hunter';
export type Provider = UserSettableProvider;

export interface ProviderInfo {
  value: Provider;
  label: string;
  hint: string;
}

export const PROVIDERS: ProviderInfo[] = [
  { value: 'openrouter', label: 'OpenRouter', hint: 'sk-or-v1-...' },
  { value: 'anthropic', label: 'Anthropic', hint: 'sk-ant-...' },
  { value: 'elevenlabs', label: 'ElevenLabs', hint: '20+ char token' },
  { value: 'd-id', label: 'D-ID', hint: 'Basic ...' },
  { value: 'muapi', label: 'MuAPI', hint: '20+ char token' },
  { value: 'apollo', label: 'Apollo.io', hint: 'lead finder key' },
  { value: 'hunter', label: 'Hunter.io', hint: 'email finder key' },
];

export const PROVIDER_ICONS: Record<Provider, React.ComponentType<{ className?: string }>> = {
  openrouter: Globe,
  anthropic: Bot,
  elevenlabs: Volume2,
  'd-id': Video,
  muapi: Layers,
  apollo: Search,
  hunter: Mail,
};

export interface TestResult {
  provider: Provider;
  ok: boolean;
  latencyMs?: number;
  error?: string;
}

export interface ByokKeyFormProps {
  configured: Provider[];
}

export function stripNamespace(fullKey: string): string {
  return fullKey.startsWith('byok.') ? fullKey.slice(5) : fullKey;
}
