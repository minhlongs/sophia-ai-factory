/**
 * Setup wizard provider mappings and initial configuration constants.
 *
 * @module tree/components/setup-wizard/steps/setup-wizard-constants
 */

export const KEY_TO_PROVIDER: Record<string, string> = {
  OPENROUTER_API_KEY: 'openrouter',
  ANTHROPIC_API_KEY: 'anthropic',
  ELEVENLABS_API_KEY: 'elevenlabs',
  DID_API_KEY: 'd-id',
  MUAPI_API_KEY: 'muapi',
  REPLICATE_API_KEY: 'replicate',
  FAL_API_KEY: 'fal-ai',
};

export const INITIAL_CONFIG = {
  OPENROUTER_API_KEY: '',
  ANTHROPIC_API_KEY: '',
  ELEVENLABS_API_KEY: '',
  DID_API_KEY: '',
  MUAPI_API_KEY: '',
  REPLICATE_API_KEY: '',
  FAL_API_KEY: '',
} as const;

export type WizardConfig = Record<keyof typeof INITIAL_CONFIG, string>;
