import { useTranslations } from "next-intl";
import { UNIFIED_TIERS } from "@/seed/config/tiers";

/** Grouped feature sets — one group per product (Video Factory + AI Automation). */
export interface FeatureGroups {
  video: string[];
  raas: string[];
}

/**
 * usePricingData — builds pricing tier display data from unified config + i18n.
 * Features are split into two groups: Video Factory and AI Automation (RaaS).
 */
export const usePricingData = () => {
  const t = useTranslations("landing");

  const PRICING_TIERS = [
    {
      name: t("pricing.tiers.starter.name"),
      description: t("pricing.tiers.starter.description"),
      tier: "BASIC",
      monthlyPrice: UNIFIED_TIERS.BASIC.priceInCents,
      featureGroups: {
        video: [
          t("pricing.features.templates_5"),
          t("pricing.features.campaigns_10"),
          t("pricing.features.youtube_1"),
          t("pricing.features.basic_analytics"),
        ],
        raas: [
          t("pricing.features.mcu_1000"),
          t("pricing.features.team_members_1"),
          t("pricing.features.email_support"),
        ],
      } as FeatureGroups,
    },
    {
      name: t("pricing.tiers.growth.name"),
      description: t("pricing.tiers.growth.description"),
      tier: "PREMIUM",
      monthlyPrice: UNIFIED_TIERS.PREMIUM.priceInCents,
      featureGroups: {
        video: [
          t("pricing.features.unlimited_templates"),
          t("pricing.features.campaigns_50"),
          t("pricing.features.youtube_3"),
          t("pricing.features.roi_calculator"),
        ],
        raas: [
          t("pricing.features.mcu_5000"),
          t("pricing.features.team_members_5"),
          t("pricing.features.api_webhooks"),
        ],
      } as FeatureGroups,
      popular: true,
    },
    {
      name: t("pricing.tiers.premium.name"),
      description: t("pricing.tiers.premium.description"),
      tier: "ENTERPRISE",
      monthlyPrice: UNIFIED_TIERS.ENTERPRISE.priceInCents,
      featureGroups: {
        video: [
          t("pricing.features.custom_templates"),
          t("pricing.features.campaigns_unlimited"),
          t("pricing.features.youtube_unlimited"),
          t("pricing.features.custom_integrations"),
        ],
        raas: [
          t("pricing.features.mcu_20000"),
          t("pricing.features.team_members_unlimited"),
          t("pricing.features.api_webhooks"),
        ],
      } as FeatureGroups,
    },
  ];

  const MASTER_TIER = {
    name: t("pricing.tiers.master.name"),
    description: t("pricing.tiers.master.description"),
    tier: "MASTER",
    price: UNIFIED_TIERS.MASTER.priceInCents,
    features: [
      t("pricing.features.everything_premium"),
      t("pricing.features.lifetime_access"),
      t("pricing.features.mcu_100000"),
      t("pricing.features.team_members_unlimited"),
      t("pricing.features.onboarding"),
      t("pricing.features.vip_support"),
      t("pricing.features.strategy_review"),
      t("pricing.features.white_label_license"),
      t("pricing.features.early_access"),
      t("pricing.features.custom_integrations"),
    ],
  };

  return { PRICING_TIERS, MASTER_TIER };
};
