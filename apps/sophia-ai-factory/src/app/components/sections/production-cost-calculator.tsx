"use client";

import { Container } from "@/components/ui/container";
import { Card, CardContent } from "@/components/ui/card";
import { SectionHeading } from "@/components/ui/section-heading";
import { useState, useMemo, useCallback } from "react";
import { UNIFIED_TIERS } from "@/config/tiers";
import { calculateCostBreakdown, API_COSTS, INFRA_COSTS } from "@/lib/billing/video-production-cost-engine";
import type { Tier } from "@/types";
import { SliderInput, CostRow, MetricCard, fmt, fmtUSD } from "./production-cost-calculator-parts";

const tiers = Object.keys(UNIFIED_TIERS) as Tier[];
const tierLabels = Object.fromEntries(
  tiers.map(t => {
    const c = UNIFIED_TIERS[t];
    const suffix = c.billingType === 'lifetime' ? '(trọn đời)' : '/tháng';
    return [t, `${c.name} ($${c.price.toLocaleString()} ${suffix})`];
  })
) as Record<Tier, string>;

const TIER_DEFAULTS: Record<Tier, { channels: number; videosPerWeek: number; avgViews: number }> = {
  BASIC:      { channels: 1, videosPerWeek: 3,  avgViews: 500 },
  PREMIUM:    { channels: 3, videosPerWeek: 10, avgViews: 1000 },
  ENTERPRISE: { channels: 5, videosPerWeek: 20, avgViews: 2000 },
  MASTER:     { channels: 10, videosPerWeek: 30, avgViews: 5000 },
};

const AD_CPM = 2.0;
const MANUAL_COST_PER_VIDEO = 50;

export function ProductionCostCalculator() {
  const [selectedTier, setSelectedTier] = useState<Tier>("PREMIUM");
  const [channels, setChannels] = useState(3);
  const [videosPerWeek, setVideosPerWeek] = useState(10);
  const [avgViews, setAvgViews] = useState(1000);
  // Affiliate SaaS inputs
  const [conversionRate, setConversionRate] = useState(2); // % viewers → click affiliate link
  const [avgCommission, setAvgCommission] = useState(30); // $ per sale (recurring first month)
  const [leadCaptureRate, setLeadCaptureRate] = useState(1); // % viewers → email signup

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

  const result = useMemo(() => {
    const totalVideos = channels * videosPerWeek * 4;
    const totalViews = totalVideos * avgViews;

    // API costs (HeyGen, ElevenLabs, OpenRouter)
    const apiCost = calculateCostBreakdown(totalVideos);
    const monthlyApiCost = (apiCost.variableCostPerVideo * totalVideos) + apiCost.monthlyFixedCosts;
    const totalMonthlyCost = monthlyCost + monthlyApiCost;

    // 1. YouTube Ads (CPM)
    const adRevenue = (totalViews / 1000) * AD_CPM;

    // 2. Affiliate SaaS Commission
    const affiliateClicks = totalViews * (conversionRate / 100);
    const affiliateSales = affiliateClicks * 0.05;
    const affiliateRevenue = affiliateSales * avgCommission;

    // 3. Lead Generation
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
      adRevenue: Math.round(adRevenue),
      affiliateRevenue: Math.round(affiliateRevenue),
      affiliateSales: Math.round(affiliateSales),
      leadRevenue: Math.round(leadRevenue),
      leads: Math.round(leads),
      monthlyRevenue: Math.round(monthlyRevenue),
      monthlyProfit: Math.round(monthlyProfit),
      monthlyApiCost: Math.round(monthlyApiCost),
      apiCostPerVideo: Math.round(apiCost.variableCostPerVideo * 100) / 100,
      apiFixedCost: apiCost.monthlyFixedCosts,
      totalMonthlyCost: Math.round(totalMonthlyCost),
      manualCost: Math.round(manualCost),
      savings: Math.round(savings),
      paybackDays, roiPercent: Math.round(roiPercent),
      annualRevenue: Math.round(monthlyRevenue * 12),
      annualProfit: Math.round(monthlyProfit * 12),
      costPerVideo: totalVideos > 0 ? Math.round((totalMonthlyCost / totalVideos) * 100) / 100 : 0,
    };
  }, [channels, videosPerWeek, avgViews, conversionRate, avgCommission, leadCaptureRate, monthlyCost, tierConfig.price]);

  return (
    <section id="cost-calculator" className="py-12 md:py-24 relative">
      <Container>
        <SectionHeading title="Tính ROI Cho Affiliate SaaS" subtitle="Xem doanh thu từ quảng cáo, hoa hồng affiliate, và lead generation khi dùng Sophia AI Factory" />

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 max-w-6xl mx-auto">
          <div className="space-y-6">
            {/* Tier selector */}
            <Card glass>
              <CardContent className="p-6">
                <h3 className="text-lg font-semibold text-foreground mb-4">Chọn Gói Sophia</h3>
                <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Gói dịch vụ">
                  {tiers.map((t) => (
                    <button key={t} role="radio" aria-checked={selectedTier === t} onClick={() => handleTierChange(t)}
                      className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${selectedTier === t ? "bg-[var(--neon-cyan)]/20 border border-[var(--neon-cyan)] text-[var(--neon-cyan)]" : "bg-white/5 border border-white/10 text-muted-foreground hover:bg-white/10"}`}>
                      {tierLabels[t]}
                    </button>
                  ))}
                </div>
                <div className="mt-4 space-y-2">
                  {isLifetime ? (
                    <>
                      <CostRow label="Phí một lần (trọn đời)" value={fmtUSD(tierConfig.price)} highlight />
                      <CostRow label="Tương đương / tháng" value={fmtUSD(monthlyCost)} />
                    </>
                  ) : (
                    <CostRow label="Phí Sophia / tháng" value={fmtUSD(tierConfig.price)} highlight />
                  )}
                  <CostRow label="Chi phí / video" value={fmtUSD(result.costPerVideo)} />
                </div>
              </CardContent>
            </Card>

            {/* Channel scale */}
            <Card glass>
              <CardContent className="p-6 space-y-5">
                <h3 className="text-lg font-semibold text-foreground">Quy Mô Kênh</h3>
                <SliderInput label="Số kênh YouTube" value={channels} min={1} max={10} onChange={setChannels} />
                <SliderInput label="Video / tuần" value={videosPerWeek} min={1} max={30} onChange={setVideosPerWeek} />
                <SliderInput label="Lượt xem TB / video" value={avgViews} min={100} max={50000} step={100} onChange={setAvgViews} />
              </CardContent>
            </Card>

            {/* Affiliate SaaS parameters */}
            <Card glass>
              <CardContent className="p-6 space-y-5">
                <h3 className="text-lg font-semibold text-foreground">Thông Số Affiliate</h3>
                <SliderInput label="Tỷ lệ click affiliate (%)" value={conversionRate} min={0.5} max={10} step={0.5} onChange={setConversionRate} />
                <SliderInput label="Hoa hồng TB / đơn ($)" value={avgCommission} min={5} max={200} step={5} onChange={setAvgCommission} />
                <SliderInput label="Tỷ lệ capture email (%)" value={leadCaptureRate} min={0.5} max={5} step={0.5} onChange={setLeadCaptureRate} />
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            {/* Revenue breakdown by source */}
            <Card glass>
              <CardContent className="p-6">
                <h3 className="text-lg font-semibold text-foreground mb-4">Doanh Thu Theo Nguồn</h3>
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <MetricCard label="Video / tháng" value={fmt(result.totalVideos)} unit="video" />
                  <MetricCard label="Lượt xem / tháng" value={fmt(result.totalViews)} unit="views" />
                </div>
                <div className="space-y-3">
                  <CostRow label="YouTube Ads (CPM)" value={fmtUSD(result.adRevenue)} />
                  <CostRow label={`Affiliate SaaS (${result.affiliateSales} đơn × $${avgCommission})`} value={fmtUSD(result.affiliateRevenue)} />
                  <CostRow label={`Lead Gen (${result.leads} leads → deals)`} value={fmtUSD(result.leadRevenue)} />
                  <div className="border-t border-white/10 pt-3">
                    <CostRow label="Tổng doanh thu / tháng" value={fmtUSD(result.monthlyRevenue)} highlight />
                  </div>
                  <div className="border-t border-white/10 pt-3 space-y-2">
                    <p className="text-xs text-muted-foreground font-medium">Chi phí vận hành đầy đủ</p>
                    <CostRow label={isLifetime ? "Sophia License (trọn đời ÷ 12)" : "Sophia License"} value={`-${fmtUSD(monthlyCost)}`} />
                    <CostRow label={`HeyGen ($${API_COSTS.heygen.perMinute}/video + $${API_COSTS.heygen.monthlyFixed}/th)`} value={`-${fmtUSD(result.totalVideos * API_COSTS.heygen.perMinute + API_COSTS.heygen.monthlyFixed)}`} />
                    <CostRow label={`ElevenLabs ($${API_COSTS.elevenlabs.perScript}/video + $${API_COSTS.elevenlabs.monthlyFixed}/th)`} value={`-${fmtUSD(result.totalVideos * API_COSTS.elevenlabs.perScript + API_COSTS.elevenlabs.monthlyFixed)}`} />
                    <CostRow label={`OpenRouter ($${API_COSTS.openrouter.perScript}/script)`} value={`-${fmtUSD(result.totalVideos * API_COSTS.openrouter.perScript)}`} />
                    <CostRow label={`Inngest ($${INFRA_COSTS.inngest}/th)`} value={`-${fmtUSD(INFRA_COSTS.inngest)}`} />
                    <CostRow label={`Cloud + Redis + Email`} value={`-${fmtUSD(INFRA_COSTS.cloudflareWorkers + INFRA_COSTS.domain + INFRA_COSTS.cloudflareR2 + INFRA_COSTS.upstashRedis + INFRA_COSTS.resend)}`} />
                    <CostRow label="Tổng chi phí / tháng" value={`-${fmtUSD(result.totalMonthlyCost)}`} highlight />
                  </div>
                  <div className="border-t border-white/10 pt-3">
                    <CostRow label="Lợi nhuận ròng / tháng" value={fmtUSD(result.monthlyProfit)} highlight />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* ROI */}
            <Card glass>
              <CardContent className="p-6">
                <h3 className="text-lg font-semibold text-foreground mb-4">ROI & Hoàn Vốn</h3>
                <div className="flex gap-4 mb-4">
                  <RoiBadge label="ROI" value={result.roiPercent} unit="%" good={result.roiPercent > 0} />
                  <RoiBadge label="Hoàn vốn" value={result.paybackDays} unit="ngày" good={result.paybackDays <= 30} />
                </div>
                <div className="space-y-3">
                  <CostRow label="Doanh thu / năm" value={fmtUSD(result.annualRevenue)} />
                  <CostRow label="Tổng chi phí / năm" value={fmtUSD(result.totalMonthlyCost * 12)} />
                  <div className="border-t border-white/10 pt-3">
                    <CostRow label="Lợi nhuận / năm" value={fmtUSD(result.annualProfit)} highlight />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Savings vs manual */}
            <Card glass className="border-[var(--neon-cyan)]/30">
              <CardContent className="p-6">
                <h3 className="text-lg font-semibold text-foreground mb-2">So Với Thuê Editor Thủ Công</h3>
                <div className="text-center py-4">
                  <p className="text-xs text-muted-foreground">Thuê editor: ~$50/video × {result.totalVideos} video = {fmtUSD(result.manualCost)}/tháng</p>
                  <p className="text-4xl font-bold bg-gradient-to-r from-[var(--neon-cyan)] to-[var(--neon-purple)] bg-clip-text text-transparent mt-3">
                    Tiết kiệm {fmtUSD(result.savings)}/tháng
                  </p>
                  <p className="text-sm text-muted-foreground mt-2">= {fmtUSD(result.savings * 12)}/năm so với thuê người làm</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        <p className="text-center text-muted-foreground text-xs mt-8 max-w-3xl mx-auto">
          Chi phí bao gồm ĐẦY ĐỦ: Sophia License + HeyGen ($99/th + $0.50/video) + ElevenLabs ($22/th + $0.04/video) + OpenRouter ($0.03/script) + Inngest ($25/th) + Cloudflare ($5/th) + Upstash Redis ($10/th) + Resend ($5/th) + Domain ($1/th).
          YouTube, TikTok, Telegram: MIỄN PHÍ. Doanh thu: CPM $2/1K views | Click-to-sale 5% | Lead-to-deal 3%. Affiliate SaaS có recurring commission — con số trên chỉ tính tháng đầu.
        </p>
      </Container>
    </section>
  );
}

function RoiBadge({ label, value, unit, good }: { label: string; value: number; unit: string; good: boolean }) {
  return (
    <div className={`flex-1 text-center p-3 rounded-lg ${good ? "bg-green-500/10" : "bg-red-500/10"}`}>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`text-2xl font-bold ${good ? "text-green-400" : "text-red-400"}`}>{fmt(value)} {unit}</p>
    </div>
  );
}
