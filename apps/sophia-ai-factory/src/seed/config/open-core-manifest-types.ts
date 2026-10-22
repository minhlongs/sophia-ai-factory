/**
 * Open-Core vs. Commercial SaaS Module & Feature Manifest Types
 *
 * Layer: seed/config
 * @module seed/config/open-core-manifest-types
 */

export type SophiaEdition = 'community' | 'cloud' | 'enterprise';
export type LicenseScopeTier = 'COMMUNITY' | 'CLOUD_SAAS' | 'ENTERPRISE_MASTER';

export type SophiaModuleFeatureId =
  | 'byok_setup_wizard'
  | 'bilingual_ask_router'
  | 'single_channel_video_studio'
  | 'telegram_bot_commands'
  | 'managed_social_oauth_relay'
  | 'growth_triad_bandit_kelly'
  | 'affiliate_attribution_payouts'
  | 'operator_affiliate_payout_admin'
  | 'multi_tenant_saas_billing'
  | 'white_label_agency_portal'
  | 'custom_domain_provisioning'
  | 'merkle_ipo_audit_vault'
  | 'day1_master_handover_suite';

export interface OpenCoreFeatureSpec {
  readonly id: SophiaModuleFeatureId;
  readonly scope: LicenseScopeTier;
  readonly licenseSpdx: 'Apache-2.0' | 'LicenseRef-Sophia-Commercial-FSL-1.1';
  readonly minPaidTier: 'FREE' | 'BASIC' | 'PREMIUM' | 'ENTERPRISE' | 'MASTER';
  readonly modulePaths: readonly string[];
  readonly titleVi: string;
  readonly titleEn: string;
  readonly summaryVi: string;
  readonly summaryEn: string;
  readonly upgradeCtaUrl: string;
}
