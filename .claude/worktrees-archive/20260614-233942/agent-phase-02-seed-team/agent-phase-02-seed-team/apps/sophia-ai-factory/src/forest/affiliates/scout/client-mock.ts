/**
 * Mock affiliate network client.
 * Returns deterministic fake affiliates via a numeric seed.
 * Used when no real API credentials are configured.
 * @module lib/affiliates/scout/client-mock
 */

import type { NetworkClient, ScoutEnv, Affiliate } from './types';

type AffiliateRaw = Omit<Affiliate, 'id' | 'tenantId' | 'discoveredAt'>;

const MOCK_PROGRAMS: AffiliateRaw[] = [
  {
    network: 'mock',
    externalId: 'mock-001',
    productName: 'FinTech Pro SaaS',
    productUrl: 'https://example.com/fintechpro',
    commissionPct: 30,
    commissionFlatUsd: undefined,
    category: 'fintech',
    description: 'B2B fintech platform — recurring 30% commission.',
    rawPayload: JSON.stringify({ source: 'mock', tier: 'ENTERPRISE' }),
  },
  {
    network: 'mock',
    externalId: 'mock-002',
    productName: 'CryptoFlow Analytics',
    productUrl: 'https://example.com/cryptoflow',
    commissionPct: undefined,
    commissionFlatUsd: 75,
    category: 'crypto',
    description: 'On-chain analytics tool. $75 flat per referred signup.',
    rawPayload: JSON.stringify({ source: 'mock', tier: 'PREMIUM' }),
  },
  {
    network: 'mock',
    externalId: 'mock-003',
    productName: 'AI Marketing Suite',
    productUrl: 'https://example.com/aimarketing',
    commissionPct: 20,
    commissionFlatUsd: undefined,
    category: 'saas',
    description: 'AI-powered marketing automation — 20% recurring.',
    rawPayload: JSON.stringify({ source: 'mock', tier: 'PREMIUM' }),
  },
];

/** Deterministic seed-based mock client — no real network calls. */
export const mockClient: NetworkClient = {
  network: 'mock',

  async fetch(_env: ScoutEnv, _tenantId: string): Promise<AffiliateRaw[]> {
    // Always returns the same deterministic set
    return MOCK_PROGRAMS;
  },
};
