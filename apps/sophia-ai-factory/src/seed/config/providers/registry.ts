/**
 * Provider Registry & Config Types
 *
 * Centralized registry for all affiliate discovery and social provider configs.
 * Enforces Zod-based type safety for BYOK (Bring Your Own Key) workflows.
 *
 * Layer: seed/config/providers
 * @module seed/config/providers/registry
 */

import { z } from 'zod';

export const ProviderSchema = z.object({
  id: z.string(),
  name: z.string(),
  isEnabled: z.boolean(),
  apiKey: z.string().optional().describe('BYOK encrypted secret'),
  endpoint: z.string().url().optional(),
});

export type ProviderConfig = z.infer<typeof ProviderSchema>;

export const PROVIDER_REGISTRY: Record<string, ProviderConfig> = {
  PRODUCT_HUNT: { id: 'ph', name: 'ProductHunt', isEnabled: false },
  COINGECKO: { id: 'cg', name: 'CoinGecko', isEnabled: false },
  N8N_SYNDICATOR: { id: 'n8n', name: 'N8N Automation', isEnabled: true },
};
