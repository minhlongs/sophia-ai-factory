"use client";

import { getCsrfHeaders } from '@/seed/security/use-csrf-token';
import { isMaskedOrPlaceholderCredential } from '@/tree/byok/provider-probe-endpoints';
import type { TierType } from './payment-step';
import {
  KEY_TO_PROVIDER,
  type WizardConfig,
} from './setup-wizard-constants';

export function fetchSetupWizardInitialData(callbacks: {
  onSavedProviders: (providers: string[]) => void;
  onEmail: (email: string) => void;
  onReadiness: (data: {
    isOwner?: boolean;
    tier?: TierType;
    mcuBalance?: number;
    subscriptionStatus?: string;
  }) => void;
}) {
  fetch('/api/user/byok')
    .then(async (res) => (res.ok ? ((await res.json()) as { providers?: string[] }) : null))
    .then((d) => {
      if (d?.providers) callbacks.onSavedProviders(d.providers);
    })
    .catch(() => {});

  fetch('/api/user/profile')
    .then(async (res) => (res.ok ? ((await res.json()) as { email?: string }) : null))
    .then((d) => {
      if (d?.email) callbacks.onEmail(d.email);
    })
    .catch(() => {});

  fetch('/api/setup-wizard/readiness')
    .then(async (res) =>
      res.ok
        ? ((await res.json()) as {
            isOwner?: boolean;
            tier?: TierType;
            mcuBalance?: number;
            subscriptionStatus?: string;
          })
        : null,
    )
    .then((d) => {
      if (d) callbacks.onReadiness(d);
    })
    .catch(() => {});
}

export async function saveWizardProviderKeys(
  config: WizardConfig,
  onProviderSaved?: (provider: string) => void,
): Promise<string[]> {
  const entries = (Object.keys(KEY_TO_PROVIDER) as Array<keyof WizardConfig>)
    .map((k) => ({ provider: KEY_TO_PROVIDER[k], key: config[k].trim() }))
    .filter((e) => e.key.length > 0 && !isMaskedOrPlaceholderCredential(e.key));

  const savedProviders: string[] = [];
  for (const entry of entries) {
    const res = await fetch('/api/user/byok', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getCsrfHeaders() },
      body: JSON.stringify(entry),
    });
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      throw new Error(body.error || `Failed to save ${entry.provider} key`);
    }
    savedProviders.push(entry.provider);
    onProviderSaved?.(entry.provider);
  }
  return savedProviders;
}
