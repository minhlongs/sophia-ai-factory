export interface ApiKeysConfig {
  OPENROUTER_API_KEY: string;
  ANTHROPIC_API_KEY: string;
  ELEVENLABS_API_KEY: string;
  DID_API_KEY: string;
  MUAPI_API_KEY: string;
  REPLICATE_API_KEY: string;
  FAL_API_KEY: string;
}

export type KeyVerificationStatus = 'idle' | 'validating' | 'valid' | 'invalid';

export interface ApiKeysStepProps {
  config: ApiKeysConfig;
  updateConfig: (key: string, value: string) => void;
  verifyKey: (service: string, keyName: string, keyValue: string) => Promise<boolean>;
  status: Record<string, KeyVerificationStatus>;
  errors: Record<string, string>;
  latencies?: Record<string, number>;
  savedProviders?: string[];
  onRevokeProvider?: (provider: string, keyName: string) => Promise<void>;
  revokingProvider?: string | null;
  saveError?: string | null;
  isSaving?: boolean;
  onNext: () => void;
  onBack?: () => void;
}
