/**
 * Linux Foundation A2A Agent Card & HTTP x402 Payment Protocol Contract.
 *
 * Clean-room primitives enabling autonomous AI agents to discover Sophia's
 * capabilities via /.well-known/agent.json without exposing tenant state or
 * BYOK keys, and advertising non-custodial USDC pay-per-action headers
 * (PAYMENT-REQUIRED / PAYMENT-SIGNATURE / PAYMENT-RESPONSE).
 *
 * Layer: seed/aeo (pure types & deterministic builders)
 *
 * @module seed/aeo/x402-payment-contract
 */

export const X402_HEADERS = {
  REQUIRED: 'PAYMENT-REQUIRED',
  SIGNATURE: 'PAYMENT-SIGNATURE',
  RESPONSE: 'PAYMENT-RESPONSE',
} as const;

export interface A2ASkillDescriptor {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly tags: readonly string[];
}

export interface X402PaymentCapability {
  readonly protocol: 'x402';
  readonly version: '1.0';
  readonly asset: 'USDC';
  readonly networks: readonly string[];
  readonly custody: 'non-custodial';
  readonly headers: typeof X402_HEADERS;
}

export interface A2AExtensionBlock {
  readonly protocol: 'A2A';
  readonly version: '0.2';
  readonly capabilities: {
    readonly streaming: boolean;
    readonly pushNotifications: boolean;
    readonly stateTransitionHistory: boolean;
    readonly opaqueTenantState: true;
  };
  readonly skills: readonly A2ASkillDescriptor[];
  readonly payment: X402PaymentCapability;
}

export function buildSophiaA2AExtension(): A2AExtensionBlock {
  return {
    protocol: 'A2A',
    version: '0.2',
    capabilities: {
      streaming: false,
      pushNotifications: true,
      stateTransitionHistory: true,
      opaqueTenantState: true,
    },
    skills: [
      {
        id: 'policy_preflight_4matrix',
        name: '4-Matrix Compliance Preflight',
        description:
          'Sanitizes crypto & SaaS affiliate scripts against Jurisdiction (US/UK/EU/VN/SG), Platform, Provider, and Vertical rules.',
        tags: ['compliance', 'crypto', 'saas', 'policy-as-code'],
      },
      {
        id: 'omnichannel_affiliate_pack',
        name: 'Omnichannel Affiliate Campaign & Atomizer',
        description:
          'Generates AutoGEO-optimized scripts, delayed-comment affiliate plugs, and native X/Telegram/Reddit/TikTok packs.',
        tags: ['affiliate', 'autogeo', 'video', 'repurposing'],
      },
      {
        id: 'edge_shortlink_attribution',
        name: 'Bot-Filtered Edge Shortlink Attribution',
        description:
          'Mints /api/r/[code] shortlinks with preview-bot filtering and multi-currency Domain B commission attribution.',
        tags: ['attribution', 'shortlink', 'epc'],
      },
    ],
    payment: {
      protocol: 'x402',
      version: '1.0',
      asset: 'USDC',
      networks: ['base', 'solana'],
      custody: 'non-custodial',
      headers: X402_HEADERS,
    },
  };
}
