/**
 * Affiliate Network Webhook Configurations and Signature Extraction
 *
 * @module app/api/webhooks/affiliate/[network]/affiliate-network-configs
 */

import type { NextRequest } from 'next/server';
import type { AffiliateNetwork } from '@/tree/affiliate/attribution-parser';

export interface NetworkConfig {
  network: AffiliateNetwork;
  secretEnv: string;
  sigHeaders: string[];
  algorithm: 'SHA-256' | 'SHA-1' | 'SHA-512';
}

export const NETWORK_CONFIGS: Record<string, NetworkConfig> = {
  tiktok_shop: {
    network: 'tiktok_shop',
    secretEnv: 'TIKTOK_SHOP_WEBHOOK_SECRET',
    sigHeaders: ['x-tts-signature', 'x-signature'],
    algorithm: 'SHA-256',
  },
  'tiktok-shop': {
    network: 'tiktok_shop',
    secretEnv: 'TIKTOK_SHOP_WEBHOOK_SECRET',
    sigHeaders: ['x-tts-signature', 'x-signature'],
    algorithm: 'SHA-256',
  },
  amazon_associates: {
    network: 'amazon_associates',
    secretEnv: 'AMAZON_WEBHOOK_SECRET',
    sigHeaders: ['x-amazon-signature', 'x-amz-signature', 'x-signature'],
    algorithm: 'SHA-256',
  },
  amazon: {
    network: 'amazon_associates',
    secretEnv: 'AMAZON_WEBHOOK_SECRET',
    sigHeaders: ['x-amazon-signature', 'x-amz-signature', 'x-signature'],
    algorithm: 'SHA-256',
  },
  clickbank: {
    network: 'clickbank',
    secretEnv: 'CLICKBANK_INS_SECRET',
    sigHeaders: ['x-clickbank-signature', 'authorization', 'x-signature'],
    algorithm: 'SHA-1',
  },
  accesstrade: {
    network: 'accesstrade',
    secretEnv: 'ACCESSTRADE_WEBHOOK_SECRET',
    sigHeaders: ['x-accesstrade-signature', 'x-signature'],
    algorithm: 'SHA-256',
  },
  awin: {
    network: 'awin',
    secretEnv: 'AWIN_WEBHOOK_SECRET',
    sigHeaders: ['x-awin-signature', 'x-signature'],
    algorithm: 'SHA-256',
  },
};

export function extractAffiliateSignature(
  request: NextRequest,
  sigHeaders: string[],
): string {
  for (const h of sigHeaders) {
    const val = request.headers.get(h);
    if (val) {
      return val;
    }
  }
  return '';
}

export interface AffiliateWebhookReadiness {
  network: AffiliateNetwork;
  secretEnv: string;
  configured: boolean;
}

const CANONICAL_WEBHOOK_NETWORKS: readonly AffiliateNetwork[] = [
  'tiktok_shop',
  'amazon_associates',
  'clickbank',
  'accesstrade',
  'awin',
];

export function getAffiliateWebhookReadiness(): AffiliateWebhookReadiness[] {
  return CANONICAL_WEBHOOK_NETWORKS.map((net) => {
    const cfg = NETWORK_CONFIGS[net];
    return {
      network: net,
      secretEnv: cfg.secretEnv,
      configured: Boolean(process.env[cfg.secretEnv]?.trim()),
    };
  });
}
