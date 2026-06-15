"use client";

import { Container } from "@/seed/components/ui/container";
import { Card, CardContent } from "@/seed/components/ui/card";
import { SectionHeading } from "@/seed/components/ui/section-heading";
import { useState, useMemo, useCallback } from "react";
import { useTranslations } from "next-intl";
import { UNIFIED_TIERS } from "@/seed/config/tiers";
import { calculateCostBreakdown, API_COSTS, INFRA_COSTS } from "@/land/billing/video-production-cost-engine";
import type { Tier } from "@/seed/types";
import { SliderInput, CostRow, MetricCard, fmt, fmtUSD } from "./production-cost-calculator-parts";
import { CostResultPanel } from "./production-cost-calculator-results";

const tiers = Object.keys(UNIFIED_TIERS) as Tier[];

const TIER_DEFAULTS: Record<Tier, { channels: number; videosPerWeek: number; avgViews: number }> = {
  BASIC:      { channels: 1, videosPerWeek: 3,  avgViews: 500 },
  PREMIUM:    { channels: 3, videosPerWeek: 10, avgViews: 1000 },
  ENTERPRISE: { channels: 5, videosPerWeek: 20, avgViews: 2000 },
  MASTER:     { channels: 10, videosPerWeek: 30, avgViews: 5000 },
};

const AD_CPM = 2.0;
const MANUAL_COST_PER_VIDEO = 50;

export function ProductionCostCalculator() {
  const t = useTranslations("landing.roi");
  const [selectedTier, setSelectedTier] = useState<Tier>("PREMIUM");
  const [channels, setChannels] = useState(3);
  const [videosPerWeek, setVideosPerWeek] = useState(10);
  const [avgViews, setAvgViews] = useState(1000);
  const [conversionRate, setConversionRate] = useState(2);
  const [avgCommission, setAvgCommission] = useState(30);
  const [leadCaptureRate, setLeadCaptureRate] = useState(1);

  const handleTierChange = useCallback((tier: Tier) => {
    setSelectedTier(tier);
    const d = TIER_DEFAULTS[tier];
    setChannels(d.channels);
    setVideosPerWeek(d.videosPerWeek);
    setAvgViews(d.avgViews);
  }, []);

  const tierConfig = UNIFIED_TIERS[selectedTier];
  const isLifetime = tierConfig.billingType === 'lifetime';
  const monthlyCost = isLifetime ? Math.round(tierConfig.price / 12) : tierConfig.price;

  const tierLabels = useMemo(() => Object.fromEntries(
    tiers.map(tier => {
      const c = UNIFIED_TIERS[tier];
      const suffix = c.billingType === 'lifetime' ? `(${t('lifetime_suffix')})` : t('monthly_suffix');
      return [tier, `${c.name} ($${c.price.toLocaleString()} ${suffix})`];
    })
  ) as Record<Tier, string>, [t]);

  const result = useMemo(() => {
    const totalVideos = channels * videosPerWeek * 4;
    const totalViews = totalVideos * avgViews;
    const apiCost = calculateCostBreakdown(totalVideos);
    const monthlyApiCost = (apiCost.variableCostPerVideo * totalVideos) + apiCost.monthlyFixedCosts;
    const totalMonthlyCost = monthlyCost + monthlyApiCost;
    const adRevenue = (totalViews / 1000) * AD_CPM;
    const affiliateClicks = totalViews * (conversionRate / 100);
    const affiliateSales = affiliateClicks * 0.05;
    const affiliateRevenue = affiliateSales * avgCommission;
    const leads = totalViews * (leadCaptureRate / 100);
    const leadDeals = leads * 0.03;
    const leadRevenue = leadDeals * 50;
    const monthlyRevenue = adRevenue + affiliateRevenue + leadRevenue;
    const monthlyProfit = monthlyRevenue - totalMonthlyCost;
    const manualCost = totalVideos * MANUAL_COST_PER_VIDEO;
    const savings = manualCost - totalMonthlyCost;
    const paybackDays = monthlyRevenue > 0 ? Math.ceil((tierConfig.price + monthlyApiCost) / monthlyRevenue * 30) : 999;
    const roiPercent = totalMonthlyCost > 0 ? ((monthlyRevenue - totalMonthlyCost) / totalMonthlyCost) * 100 : 0;

    return {
      totalVideos, totalViews,
      adRevenue: Math.round(adRevenue), affiliateRevenue: Math.round(affiliateRevenue),
      affiliateSales: Math.round(affiliateSales), leadRevenue: Math.round(leadRevenue),
      leads: Math.round(leads), monthlyRevenue: Math.round(monthlyRevenue),
      monthlyProfit: Math.round(monthlyProfit), monthlyApiCost: Math.round(monthlyApiCost),
      apiCostPerVideo: Math.round(apiCost.variableCostPerVideo * 100) / 100,
      apiFixedCost: apiCost.monthlyFixedCosts, totalMonthlyCost: Math.round(totalMonthlyCost),
      manualCost: Math.round(manualCost), savings: Math.round(savings),
      paybackDays, roiPercent: Math.round(roiPercent),
      annualRevenue: Math.round(monthlyRevenue * 12), annualProfit: Math.round(monthlyProfit * 12),
      costPerVideo: totalVideos > 0 ? Math.round((totalMonthlyCost / totalVideos) * 100) / 100 : 0,
    };
  }, [channels, videosPerWeek, avgViews, conversionRate, avgCommission, leadCaptureRate, monthlyCost, tierConfig.price]);

  return (
    <section id="cost-calculator" className="py-12 md:py-24 relative">
      <Container>
        <SectionHeading title={t("title")} subtitle={t("subtitle")} />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 max-w-6xl mx-auto">
          <div className="space-y-6">
            <Card glass>
              <CardContent className="p-6">
                <h3 className="text-lg font-semibold text-foreground mb-4">{t("tier_selector")}</h3>
                <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label={t("service_plan")}>
                  {tiers.map((tier) => (
                    <button key={tier} role="radio" aria-checked={selectedTier === tier} onClick={() => handleTierChange(tier)}
                      className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${selectedTier === tier ? "bg-[var(--neon-cyan)]/20 border border-[var(--neon-cyan)] text-[var(--neon-cyan)]" : "bg-white/5 border border-white/10 text-muted-foreground hover:bg-white/10"}`}>
                      {tierLabels[tier]}
                    </button>
                  ))}
                </div>
                <div className="mt-4 space-y-2">
                  {isLifetime ? (
                    <>
                      <CostRow label={t("one_time_fee")} value={fmtUSD(tierConfig.price)} highlight />
                      <CostRow label={t("equivalent_monthly")} value={fmtUSD(monthlyCost)} />
                    </>
                  ) : (
                    <CostRow label={t("monthly_fee")} value={fmtUSD(tierConfig.price)} highlight />
                  )}
                  <CostRow label={t("cost_per_video")} value={fmtUSD(result.costPerVideo)} />
                </div>
              </CardContent>
            </Card>
            <Card glass>
              <CardContent className="p-6 space-y-5">
                <h3 className="text-lg font-semibold text-foreground">{t("channel_scale")}</h3>
                <SliderInput label={t("channels_label")} value={channels} min={1} max={10} onChange={setChannels} />
                <SliderInput label={t("videos_week")} value={videosPerWeek} min={1} max={30} onChange={setVideosPerWeek} />
                <SliderInput label={t("avg_views")} value={avgViews} min={100} max={50000} step={100} onChange={setAvgViews} />
              </CardContent>
            </Card>
            <Card glass>
              <CardContent className="p-6 space-y-5">
                <h3 className="text-lg font-semibold text-foreground">{t("affiliate_params")}</h3>
                <SliderInput label={t("click_rate")} value={conversionRate} min={0.5} max={10} step={0.5} onChange={setConversionRate} />
                <SliderInput label={t("avg_commission")} value={avgCommission} min={5} max={200} step={5} onChange={setAvgCommission} />
                <SliderInput label={t("email_capture")} value={leadCaptureRate} min={0.5} max={5} step={0.5} onChange={setLeadCaptureRate} />
              </CardContent>
            </Card>
          </div>
          <CostResultPanel result={result} isLifetime={isLifetime} monthlyCost={monthlyCost} avgCommission={avgCommission} />
        </div>
        <p className="text-center text-muted-foreground text-xs mt-8 max-w-3xl mx-auto">{t("full_cost_disclaimer")}</p>
      </Container>
    </section>
  );
}
