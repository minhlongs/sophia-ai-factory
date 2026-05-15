/**
 * Affiliate Scout — barrel export.
 * @module lib/affiliates/scout
 */

export { runAffiliateScout } from './writer';
export type { ScoutEnv, Affiliate, Network, ScoutResult, NetworkClient } from './types';
export { shareasaleClient } from './client-shareasale';
export { awinSaasClient } from './client-awin';
export { rakutenClient } from './client-rakuten';
