/**
 * Validation, submission, and clipboard helpers for useInviteAffiliate hook.
 *
 * @module components/stitch/screens/affiliates/invite/invite-affiliate-helpers
 */

import {
  inviteAffiliateAction,
  type InviteAffiliateResult,
} from '@/forest/actions/affiliate-actions';

export const DEFAULT_INVITE_ASSET_KITS = ['brand_kit', 'video_scripts'] as const;

const EMAIL_PATTERN = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

export function validateInviteAffiliateFields(params: {
  partnerName: string;
  email: string;
  customRate: number;
  labels: {
    nameRequired: string;
    emailInvalid: string;
    rateInvalid: string;
  };
}): string | null {
  const { partnerName, email, customRate, labels } = params;

  if (!partnerName.trim() || partnerName.trim().length < 2) {
    return labels.nameRequired;
  }

  if (!email.trim() || !EMAIL_PATTERN.test(email.trim())) {
    return labels.emailInvalid;
  }

  if (isNaN(customRate) || customRate < 5 || customRate > 80) {
    return labels.rateInvalid;
  }

  return null;
}

export async function submitInviteAffiliateRequest(params: {
  partnerName: string;
  email: string;
  customRate: number;
  welcomeMessage: string;
  selectedAssetKits: string[];
  fallbackErrorLabel: string;
}): Promise<
  | { ok: true; result: InviteAffiliateResult }
  | { ok: false; errorMessage: string }
> {
  try {
    const result = await inviteAffiliateAction({
      partnerName: params.partnerName.trim(),
      email: params.email.trim().toLowerCase(),
      customRateOverridePct: Number(params.customRate),
      welcomeMessage: params.welcomeMessage.trim() || undefined,
      assetKitSelected: params.selectedAssetKits,
    });

    if (result.success) {
      return { ok: true, result };
    }
    return { ok: false, errorMessage: result.error || params.fallbackErrorLabel };
  } catch (err) {
    const msg = err instanceof Error ? err.message : params.fallbackErrorLabel;
    return { ok: false, errorMessage: msg };
  }
}

export async function copyTextWithFallback(text: string): Promise<void> {
  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      await navigator.clipboard.writeText(text);
    }
  } catch {
    // Ignore clipboard write errors in restricted contexts
  }
}
