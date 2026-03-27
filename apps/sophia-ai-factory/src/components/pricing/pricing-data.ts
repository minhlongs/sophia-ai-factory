import { useTranslations } from "next-intl";
import { UNIFIED_TIERS } from "@/lib/unified-tier-config";

/**
 * usePricingData — builds pricing tier display data from unified config + i18n.
 * Feature lists include both Video Factory and AI Automation (RaaS) features.
 */
export const usePricingData = () => {
  const t = useTranslations("landing");

  const PRICING_TIERS = [
    {
      name: t("pricing.tiers.starter.name"),
      description: t("pricing.tiers.starter.description"),
      tier: "BASIC",
      monthlyPrice: UNIFIED_TIERS.BASIC.priceInCents,
      features: [
        t("pricing.features.templates_5"),
        t("pricing.features.auto_discovery"),
        t("pricing.features.basic_analytics"),
        t("pricing.features.email_support"),
        // RaaS features
        t("pricing.features.mcu_1000"),
        t("pricing.features.ai_commands_5"),
        t("pricing.features.team_members_1"),
      ],
    },
    {
      name: t("pricing.tiers.growth.name"),
      description: t("pricing.tiers.growth.description"),
      tier: "PREMIUM",
      monthlyPrice: UNIFIED_TIERS.PREMIUM.priceInCents,
      features: [
        t("pricing.features.unlimited_templates"),
        t("pricing.features.advanced_analytics"),
        t("pricing.features.roi_calculator"),
        t("pricing.features.priority_support"),
        t("pricing.features.custom_brand"),
        // RaaS features
        t("pricing.features.mcu_5000"),
        t("pricing.features.ai_commands_15"),
        t("pricing.features.team_members_5"),
        t("pricing.features.api_webhooks"),
      ],
      popular: true,
    },
    {
      name: t("pricing.tiers.premium.name"),
      description: t("pricing.tiers.premium.description"),
      tier: "ENTERPRISE",
      monthlyPrice: UNIFIED_TIERS.ENTERPRISE.priceInCents,
      features: [
        t("pricing.features.custom_templates"),
        t("pricing.features.white_label"),
        t("pricing.features.founder_access"),
        t("pricing.features.api_access"),
        t("pricing.features.uptime_sla"),
        // RaaS features
        t("pricing.features.mcu_20000"),
        t("pricing.features.ai_commands_15_custom"),
        t("pricing.features.team_members_unlimited"),
        t("pricing.features.custom_integrations"),
      ],
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
      t("pricing.features.onboarding"),
      t("pricing.features.vip_support"),
      t("pricing.features.custom_scripts"),
      t("pricing.features.strategy_review"),
      t("pricing.features.white_label_license"),
      t("pricing.features.early_access"),
      // RaaS features
      t("pricing.features.mcu_100000"),
      t("pricing.features.ai_commands_unlimited"),
      t("pricing.features.team_members_unlimited"),
      t("pricing.features.custom_integrations"),
    ],
  };

  return { PRICING_TIERS, MASTER_TIER };
};
