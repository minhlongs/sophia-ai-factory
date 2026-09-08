/**
 * Credits Calculator — converts token usage to credit consumption per service/tier.
 * Single source of truth for credit economics.
 *
 * @module seed/billing/credits-calculator
 */

export type ServiceType = 'openrouter' | 'heygen' | 'elevenlabs' | 'muapi' | 'remotion' | 'fal-ai';

export interface CreditRate {
  creditsPerToken?: number;
  creditsPerSecond?: number;
  baseCredits?: number;
}

const RATES_BY_SERVICE_TIER: Record<string, Record<string, CreditRate>> = {
  openrouter: {
    BASIC: { creditsPerToken: 0.000001 },
    PREMIUM: { creditsPerToken: 0.0000008 },
    ENTERPRISE: { creditsPerToken: 0.0000006 },
    MASTER: { creditsPerToken: 0.0000004 },
  },
  heygen: {
    BASIC: { creditsPerToken: 0, creditsPerSecond: 0.01, baseCredits: 1 },
    PREMIUM: { creditsPerToken: 0, creditsPerSecond: 0.008, baseCredits: 0.8 },
    ENTERPRISE: { creditsPerToken: 0, creditsPerSecond: 0.006, baseCredits: 0.6 },
    MASTER: { creditsPerToken: 0, creditsPerSecond: 0.004, baseCredits: 0.4 },
  },
  elevenlabs: {
    BASIC: { creditsPerToken: 0.000002 },
    PREMIUM: { creditsPerToken: 0.0000015 },
    ENTERPRISE: { creditsPerToken: 0.000001 },
    MASTER: { creditsPerToken: 0.0000008 },
  },
  muapi: {
    BASIC: { creditsPerToken: 0.0000015 },
    PREMIUM: { creditsPerToken: 0.0000012 },
    ENTERPRISE: { creditsPerToken: 0.0000009 },
    MASTER: { creditsPerToken: 0.0000006 },
  },
  remotion: {
    BASIC: { creditsPerToken: 0, creditsPerSecond: 0.005, baseCredits: 0.5 },
    PREMIUM: { creditsPerToken: 0, creditsPerSecond: 0.004, baseCredits: 0.4 },
    ENTERPRISE: { creditsPerToken: 0, creditsPerSecond: 0.003, baseCredits: 0.3 },
    MASTER: { creditsPerToken: 0, creditsPerSecond: 0.002, baseCredits: 0.2 },
  },
  // fal.ai is free upstream — platform charges per-call credits (tier-scaled).
  'fal-ai': {
    BASIC: { baseCredits: 1 },
    PREMIUM: { baseCredits: 0.8 },
    ENTERPRISE: { baseCredits: 0.6 },
    MASTER: { baseCredits: 0.4 },
  },
};

/**
 * Calculate credits consumed for a service operation.
 */
export function calculateCredits(
  service: ServiceType,
  operation: string,
  quantity: number,
  tier: string
): number {
  const serviceRates = RATES_BY_SERVICE_TIER[service];
  if (!serviceRates) {
    throw new Error(`Unknown service: ${service}`);
  }

  const tierRate = serviceRates[tier.toUpperCase()];
  if (!tierRate) {
    throw new Error(`Unknown tier: ${tier}`);
  }

  let credits = 0;

  if (tierRate.creditsPerToken && operation === 'chatCompletion') {
    credits = quantity * tierRate.creditsPerToken;
  } else if (tierRate.creditsPerSecond && operation === 'videoDuration') {
    credits = quantity * tierRate.creditsPerSecond;
  } else if (tierRate.baseCredits) {
    credits = tierRate.baseCredits;
  }

  return Math.max(0, Math.round(credits * 1000000) / 1000000);
}

/**
 * Estimate tokens from characters (rough approximation).
 */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}
