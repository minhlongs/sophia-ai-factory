import { useTranslations } from "next-intl";

export const usePricingData = () => {
  const t = useTranslations("landing");

  const PRICING_TIERS = [
    {
      name: t("pricing.tiers.starter.name"),
      description: t("pricing.tiers.starter.description"),
      tier: "BASIC",
      monthlyPrice: 19900, // $199/mo
      features: [
        t("pricing.features.templates_5"),
        t("pricing.features.auto_discovery"),
        t("pricing.features.basic_analytics"),
        t("pricing.features.email_support"),
      ],
    },
    {
      name: t("pricing.tiers.growth.name"),
      description: t("pricing.tiers.growth.description"),
      tier: "PREMIUM",
      monthlyPrice: 39900, // $399/mo
      features: [
        t("pricing.features.unlimited_templates"),
        t("pricing.features.advanced_analytics"),
        t("pricing.features.roi_calculator"),
        t("pricing.features.priority_support"),
        t("pricing.features.custom_brand"),
      ],
      popular: true,
    },
    {
      name: t("pricing.tiers.premium.name"),
      description: t("pricing.tiers.premium.description"),
      tier: "ENTERPRISE",
      monthlyPrice: 79900, // $799/mo
      features: [
        t("pricing.features.custom_templates"),
        t("pricing.features.white_label"),
        t("pricing.features.founder_access"),
        t("pricing.features.api_access"),
        t("pricing.features.uptime_sla"),
      ],
    },
  ];

  const MASTER_TIER = {
    name: t("pricing.tiers.master.name"),
    description: t("pricing.tiers.master.description"),
    tier: "MASTER",
    price: 499900, // $4,999 one-time
    features: [
      t("pricing.features.everything_premium"),
      t("pricing.features.lifetime_access"),
      t("pricing.features.onboarding"),
      t("pricing.features.vip_support"),
      t("pricing.features.custom_scripts"),
      t("pricing.features.strategy_review"),
      t("pricing.features.white_label_license"),
      t("pricing.features.early_access"),
    ],
  };

  return { PRICING_TIERS, MASTER_TIER };
};
