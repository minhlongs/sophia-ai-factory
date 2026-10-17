/**
 * Open-Core Edition Resolver & Commercial Feature Gate
 *
 * Determines the active runtime edition (`community` | `cloud` | `enterprise`)
 * and evaluates whether a specific feature is unlocked in the current deployment
 * or requires an active Cloud subscription / verified RaaS License Key.
 *
 * Layer: seed/config
 * @module seed/config/edition-config
 */

import {
  OPEN_CORE_FEATURES,
  type OpenCoreFeatureSpec,
  type SophiaEdition,
  type SophiaModuleFeatureId,
} from './open-core-manifest';
import { getFeatureGateMessages } from './edition-messages';

export interface EditionContextInput {
  readonly sophiaEdition?: string;
  readonly appUrl?: string;
  readonly hasValidRaasLicense?: boolean;
  readonly licensedTier?: 'BASIC' | 'PREMIUM' | 'ENTERPRISE' | 'MASTER';
}

export interface FeatureGateEvaluation {
  readonly feature: OpenCoreFeatureSpec;
  readonly activeEdition: SophiaEdition;
  readonly allowed: boolean;
  readonly reasonCode:
    | 'OPEN_CORE_INCLUDED'
    | 'MANAGED_CLOUD_ACTIVE'
    | 'ENTERPRISE_LICENSE_VERIFIED'
    | 'REQUIRES_CLOUD_SUBSCRIPTION'
    | 'REQUIRES_ENTERPRISE_OR_MASTER_LICENSE';
  readonly upgradeUrl: string;
  readonly messageVi: string;
  readonly messageEn: string;
}

const OFFICIAL_HOSTS: ReadonlySet<string> = new Set([
  'sophia.agencyos.network',
  'staging.sophia.agencyos.network',
]);

const TIER_RANK: Readonly<Record<OpenCoreFeatureSpec['minPaidTier'], number>> = {
  FREE: 0, BASIC: 1, PREMIUM: 2, ENTERPRISE: 3, MASTER: 4,
};

function extractHostname(rawUrl: string): string {
  if (!rawUrl) return '';
  try { return new URL(rawUrl).hostname.toLowerCase(); } catch { return ''; }
}

function meetsMinimumTier(
  licensedTier: EditionContextInput['licensedTier'],
  requiredTier: OpenCoreFeatureSpec['minPaidTier'],
): boolean {
  if (requiredTier === 'FREE') return true;
  if (!licensedTier) return false;
  return TIER_RANK[licensedTier] >= TIER_RANK[requiredTier];
}

/** Resolves the active Sophia edition. Only grants 'enterprise' when license verified. */
export function resolveSophiaEdition(ctx?: EditionContextInput): SophiaEdition {
  if (ctx?.hasValidRaasLicense) return 'enterprise';
  const raw = (ctx?.sophiaEdition ?? process.env.SOPHIA_EDITION ?? '').trim().toLowerCase();
  if (raw === 'cloud') return 'cloud';
  if (raw === 'community') return 'community';
  const host = extractHostname(ctx?.appUrl ?? process.env.NEXT_PUBLIC_APP_URL ?? '');
  return OFFICIAL_HOSTS.has(host) ? 'cloud' : 'community';
}

/** Evaluates whether a given feature is unlocked in current edition/license context. */
export function evaluateFeatureGate(
  featureId: SophiaModuleFeatureId,
  ctx?: EditionContextInput,
): FeatureGateEvaluation {
  const feature = OPEN_CORE_FEATURES[featureId];
  const activeEdition = resolveSophiaEdition(ctx);
  const msgs = getFeatureGateMessages(feature, ctx?.licensedTier);

  if (feature.scope === 'COMMUNITY') {
    return {
      feature, activeEdition, allowed: true, reasonCode: 'OPEN_CORE_INCLUDED',
      upgradeUrl: feature.upgradeCtaUrl, messageVi: msgs.community.vi, messageEn: msgs.community.en,
    };
  }

  const tierSufficient = meetsMinimumTier(ctx?.licensedTier, feature.minPaidTier);

  if (ctx?.hasValidRaasLicense && tierSufficient) {
    return {
      feature, activeEdition: 'enterprise', allowed: true, reasonCode: 'ENTERPRISE_LICENSE_VERIFIED',
      upgradeUrl: feature.upgradeCtaUrl, messageVi: msgs.enterprise.vi, messageEn: msgs.enterprise.en,
    };
  }

  if (activeEdition === 'cloud' && ctx?.licensedTier && tierSufficient) {
    return {
      feature, activeEdition: 'cloud', allowed: true, reasonCode: 'MANAGED_CLOUD_ACTIVE',
      upgradeUrl: feature.upgradeCtaUrl, messageVi: msgs.cloud.vi, messageEn: msgs.cloud.en,
    };
  }

  const isEnterpriseOnly = feature.scope === 'ENTERPRISE_MASTER';
  return {
    feature, activeEdition, allowed: false,
    reasonCode: isEnterpriseOnly ? 'REQUIRES_ENTERPRISE_OR_MASTER_LICENSE' : 'REQUIRES_CLOUD_SUBSCRIPTION',
    upgradeUrl: feature.upgradeCtaUrl, messageVi: msgs.locked.vi, messageEn: msgs.locked.en,
  };
}

/** Boolean shorthand for checking if a feature is enabled. */
export function isCommercialFeatureEnabled(
  featureId: SophiaModuleFeatureId,
  ctx?: EditionContextInput,
): boolean {
  return evaluateFeatureGate(featureId, ctx).allowed;
}
