/**
 * Open-Core Edition Resolver & Commercial Feature Gate
 *
 * Determines the active runtime edition (`community` | 'cloud' | 'enterprise')
 * and evaluates whether a specific feature is unlocked in the current deployment
 * or requires upgrading to Managed Sophia Cloud / entering a RaaS License Key.
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

const OFFICIAL_CLOUD_HOSTNAMES: ReadonlySet<string> = new Set([
  'sophia.agencyos.network',
  'staging.sophia.agencyos.network',
]);

const TIER_RANK: Readonly<Record<OpenCoreFeatureSpec['minPaidTier'], number>> = {
  FREE: 0,
  BASIC: 1,
  PREMIUM: 2,
  ENTERPRISE: 3,
  MASTER: 4,
};

function extractNormalizedHostname(rawUrl: string): string {
  if (!rawUrl) return '';
  try {
    return new URL(rawUrl).hostname.toLowerCase();
  } catch {
    return '';
  }
}

function meetsMinimumTierRank(
  licensedTier: EditionContextInput['licensedTier'],
  requiredTier: OpenCoreFeatureSpec['minPaidTier'],
): boolean {
  if (!licensedTier) return true;
  return TIER_RANK[licensedTier] >= TIER_RANK[requiredTier];
}

/**
 * Resolves the active Sophia edition from environment or explicit context.
 * Defaults to `'cloud'` when running on `sophia.agencyos.network` and
 * `'community'` on self-hosted localhost / custom deployments without a license.
 */
export function resolveSophiaEdition(ctx?: EditionContextInput): SophiaEdition {
  const rawEdition = (
    ctx?.sophiaEdition ??
    process.env.SOPHIA_EDITION ??
    process.env.NEXT_PUBLIC_SOPHIA_EDITION ??
    ''
  )
    .trim()
    .toLowerCase();

  if (rawEdition === 'enterprise' || ctx?.hasValidRaasLicense) {
    return 'enterprise';
  }
  if (rawEdition === 'cloud') {
    return 'cloud';
  }
  if (rawEdition === 'community') {
    return 'community';
  }

  const hostname = extractNormalizedHostname(ctx?.appUrl ?? process.env.NEXT_PUBLIC_APP_URL ?? '');
  if (OFFICIAL_CLOUD_HOSTNAMES.has(hostname)) {
    return 'cloud';
  }

  return 'community';
}

/**
 * Evaluates whether a given feature is unlocked in the current edition/license context.
 */
export function evaluateFeatureGate(
  featureId: SophiaModuleFeatureId,
  ctx?: EditionContextInput,
): FeatureGateEvaluation {
  const feature = OPEN_CORE_FEATURES[featureId];
  const activeEdition = resolveSophiaEdition(ctx);

  if (feature.scope === 'COMMUNITY') {
    return {
      feature,
      activeEdition,
      allowed: true,
      reasonCode: 'OPEN_CORE_INCLUDED',
      upgradeUrl: feature.upgradeCtaUrl,
      messageVi: `Tính năng "${feature.titleVi}" nằm trong gói Open-Core miễn phí (Apache-2.0).`,
      messageEn: `Feature "${feature.titleEn}" is included in the free Open-Core Community Edition (Apache-2.0).`,
    };
  }

  const tierSufficient = meetsMinimumTierRank(ctx?.licensedTier, feature.minPaidTier);

  if ((activeEdition === 'enterprise' || ctx?.hasValidRaasLicense) && tierSufficient) {
    return {
      feature,
      activeEdition: 'enterprise',
      allowed: true,
      reasonCode: 'ENTERPRISE_LICENSE_VERIFIED',
      upgradeUrl: feature.upgradeCtaUrl,
      messageVi: `Đã mở khóa thương mại cho "${feature.titleVi}" qua giấy phép RaaS Enterprise/Master.`,
      messageEn: `Commercial feature "${feature.titleEn}" unlocked via verified RaaS Enterprise/Master license.`,
    };
  }

  if (activeEdition === 'cloud' && tierSufficient) {
    return {
      feature,
      activeEdition: 'cloud',
      allowed: true,
      reasonCode: 'MANAGED_CLOUD_ACTIVE',
      upgradeUrl: feature.upgradeCtaUrl,
      messageVi: `Tính năng "${feature.titleVi}" đang hoạt động trên Sophia Managed Cloud.`,
      messageEn: `Feature "${feature.titleEn}" is active on Sophia Managed Cloud.`,
    };
  }

  const isEnterpriseOnly = feature.scope === 'ENTERPRISE_MASTER';
  return {
    feature,
    activeEdition,
    allowed: false,
    reasonCode: isEnterpriseOnly
      ? 'REQUIRES_ENTERPRISE_OR_MASTER_LICENSE'
      : 'REQUIRES_CLOUD_SUBSCRIPTION',
    upgradeUrl: feature.upgradeCtaUrl,
    messageVi: isEnterpriseOnly
      ? `🔒 "${feature.titleVi}" thuộc bản Enterprise ($799/tháng) hoặc Master Handover ($4,999). Nâng cấp trên Sophia Cloud hoặc nhập khóa RAAS_LICENSE_KEY để mở khóa.`
      : `☁️ "${feature.titleVi}" được vận hành tự động trên Sophia Cloud (từ $199/tháng) hoặc cần khóa bản quyền thương mại. Trải nghiệm ngay không cần tự cấu hình hạ tầng.`,
    messageEn: isEnterpriseOnly
      ? `🔒 "${feature.titleEn}" requires Sophia Enterprise ($799/mo) or Master Handover ($4,999). Upgrade on Sophia Cloud or enter a valid RAAS_LICENSE_KEY to unlock.`
      : `☁️ "${feature.titleEn}" is available on Sophia Managed Cloud (from $199/mo) or with a Commercial License Key. Launch instantly without managing OAuth or queue infra.`,
  };
}

/**
 * Boolean shorthand for checking if a feature is enabled in the active runtime.
 */
export function isCommercialFeatureEnabled(
  featureId: SophiaModuleFeatureId,
  ctx?: EditionContextInput,
): boolean {
  return evaluateFeatureGate(featureId, ctx).allowed;
}
