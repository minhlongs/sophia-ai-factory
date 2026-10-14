/**
 * Setup Wizard API Fetch & Verification Helpers
 *
 * Layer: tree/components/setup-wizard/steps
 * @module tree/components/setup-wizard/steps/use-setup-wizard-helpers
 */

import type { TierType } from './payment-step';

export const KEY_TO_PROVIDER: Record<string, string> = {
  OPENROUTER_API_KEY: 'openrouter',
  ANTHROPIC_API_KEY: 'anthropic',
  ELEVENLABS_API_KEY: 'elevenlabs',
  DID_API_KEY: 'd-id',
  MUAPI_API_KEY: 'muapi',
  REPLICATE_API_KEY: 'replicate',
  FAL_API_KEY: 'fal-ai',
};

export type WizardKeyConfig = {
  OPENROUTER_API_KEY: string;
  ANTHROPIC_API_KEY: string;
  ELEVENLABS_API_KEY: string;
  DID_API_KEY: string;
  MUAPI_API_KEY: string;
  REPLICATE_API_KEY: string;
  FAL_API_KEY: string;
};

export const INITIAL_WIZARD_CONFIG: WizardKeyConfig = {
  OPENROUTER_API_KEY: '',
  ANTHROPIC_API_KEY: '',
  ELEVENLABS_API_KEY: '',
  DID_API_KEY: '',
  MUAPI_API_KEY: '',
  REPLICATE_API_KEY: '',
  FAL_API_KEY: '',
};

export interface WizardBootstrapCallbacks {
  setSavedProviders: (providers: string[]) => void;
  setAccountEmail: (email: string) => void;
  setCurrentTier: (tier: TierType) => void;
  setMcuBalance: (balance: number) => void;
  setSubscriptionStatus: (status: string) => void;
  setIsOwner: (isOwner: boolean) => void;
}

export function bootstrapSetupWizardState(cb: WizardBootstrapCallbacks): void {
  fetch('/api/user/byok')
    .then(async (res) => (res.ok ? ((await res.json()) as { providers?: string[] }) : null))
    .then((d) => {
      if (d?.providers) cb.setSavedProviders(d.providers);
    })
    .catch(() => {});

  fetch('/api/user/profile')
    .then(async (res) => (res.ok ? ((await res.json()) as { email?: string }) : null))
    .then((d) => {
      if (d?.email) cb.setAccountEmail(d.email);
    })
    .catch(() => {});

  fetch('/api/setup-wizard/readiness')
    .then(async (res) =>
      res.ok
        ? ((await res.json()) as {
            tier?: string;
            mcuBalance?: number;
            subscriptionActive?: boolean;
            ownerVerified?: boolean;
          })
        : null,
    )
    .then((d) => {
      if (d) {
        if (d.tier) cb.setCurrentTier((d.tier.toUpperCase() as TierType) || 'PREMIUM');
        if (typeof d.mcuBalance === 'number') cb.setMcuBalance(d.mcuBalance);
        if (d.subscriptionActive) cb.setSubscriptionStatus('ACTIVE');
        if (typeof d.ownerVerified === 'boolean') cb.setIsOwner(d.ownerVerified);
      }
    })
    .catch(() => {});
}
