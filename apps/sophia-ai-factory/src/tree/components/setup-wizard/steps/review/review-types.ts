/**
 * Types and helper utilities for the setup wizard review step.
 */

export interface ReviewStepConfig {
  OPENROUTER_API_KEY: string;
  ANTHROPIC_API_KEY: string;
  ELEVENLABS_API_KEY: string;
  DID_API_KEY: string;
  MUAPI_API_KEY: string;
  REPLICATE_API_KEY: string;
}

export interface ReviewStepProviderConfig {
  HEYGEN_API_KEY: string;
  RESEND_API_KEY: string;
  NOWPAYMENTS_API_KEY: string;
  HEYGEN_WEBHOOK_SECRET: string;
  ROUTING_STRATEGY: 'priority' | 'costOptimized' | 'leastUsed';
}

export interface ReviewStepProps {
  config: ReviewStepConfig;
  providerConfig: ReviewStepProviderConfig;
  onConfirm: () => void;
  onBack: () => void;
  loading?: boolean;
}

export function maskApiKey(key: string): string {
  if (!key || key.length < 8) return '••••••••';
  return key.slice(0, 4) + '•'.repeat(Math.min(key.length - 8, 12)) + key.slice(-4);
}
