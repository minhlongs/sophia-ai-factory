"use client";

import { Container } from "@/components/ui/container";
import { Card, CardContent } from "@/components/ui/card";
import { SectionHeading } from "@/components/ui/section-heading";
import { useState, useMemo, useCallback } from "react";
import { UNIFIED_TIERS } from "@/lib/unified-tier-config";
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
const AFFILIATE_PER_100 = 0.5;
const MANUAL_COST_PER_VIDEO = 50;

export function ProductionCostCalculator() {
  const [selectedTier, setSelectedTier] = useState<Tier>("PREMIUM");
  const [channels, setChannels] = useState(3);
  const [videosPerWeek, setVideosPerWeek] = useState(10);
  const [avgViews, setAvgViews] = useState(1000);

  const handleTierChange = useCallback((tier: Tier) => {
    setSelectedTier(tier);
    const d = TIER_DEFAULTS[tier];
    setChannels(d.channels);
    setVideosPerWeek(d.videosPerWeek);
    setAvgViews(d.avgViews);
  }, []);

  const tierConfig = UNIFIED_TIERS[selectedTier];
  const isLifetime = tierConfig.billingType === 'lifetime';
  /** For lifetime: amortize over 12 months for comparison */
  const monthlyCost = isLifetime ? Math.round(tierConfig.price / 12) : tierConfig.price;

  const result = useMemo(() => {
    const totalVideos = channels * videosPerWeek * 4;
    const totalViews = totalVideos * avgViews;
    const adRevenue = (totalViews / 1000) * AD_CPM;
    const affiliateRevenue = (totalViews / 100) * AFFILIATE_PER_100;
    const monthlyRevenue = adRevenue + affiliateRevenue;
    const monthlyProfit = monthlyRevenue - monthlyCost;
    const manualCost = totalVideos * MANUAL_COST_PER_VIDEO;
    const savings = manualCost - monthlyCost;
    const paybackDays = monthlyRevenue > 0
      ? Math.ceil((tierConfig.price / monthlyRevenue) * 30)
      : 999;
    const roiPercent = monthlyCost > 0
      ? ((monthlyRevenue - monthlyCost) / monthlyCost) * 100
      : 0;

    return {
      totalVideos, totalViews,
      monthlyRevenue: Math.round(monthlyRevenue),
      monthlyProfit: Math.round(monthlyProfit),
      manualCost: Math.round(manualCost),
      savings: Math.round(savings),
      paybackDays, roiPercent: Math.round(roiPercent),
      annualRevenue: Math.round(monthlyRevenue * 12),
      annualProfit: Math.round(monthlyProfit * 12),
      costPerVideo: totalVideos > 0 ? Math.round((monthlyCost / totalVideos) * 100) / 100 : 0,
    };
  }, [channels, videosPerWeek, avgViews, monthlyCost, tierConfig.price]);

  return (
    <section id="cost-calculator" className="py-20 md:py-32 relative">
      <Container>
        <SectionHeading title="Tính ROI Cho Doanh Nghiệp Của Bạn" subtitle="Xem bạn tiết kiệm bao nhiêu và kiếm được bao nhiêu khi dùng Sophia AI Factory" />

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 max-w-6xl mx-auto">
          <div className="space-y-6">
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
                      <CostRow label="Tương đương / tháng (12 tháng)" value={fmtUSD(monthlyCost)} />
                    </>
                  ) : (
                    <CostRow label="Phí Sophia / tháng" value={fmtUSD(tierConfig.price)} highlight />
                  )}
                  <CostRow label="Chi phí / video" value={fmtUSD(result.costPerVideo)} />
                  <CostRow label="Video tối đa / tháng" value={tierConfig.campaignsPerMonth >= 999 ? "Không giới hạn" : `${tierConfig.campaignsPerMonth}`} />
                </div>
              </CardContent>
            </Card>

            <Card glass>
              <CardContent className="p-6 space-y-6">
                <h3 className="text-lg font-semibold text-foreground">Quy Mô Kênh Của Bạn</h3>
                <SliderInput label="Số kênh YouTube" value={channels} min={1} max={10} onChange={setChannels} />
                <SliderInput label="Video / tuần" value={videosPerWeek} min={1} max={30} onChange={setVideosPerWeek} />
                <SliderInput label="Lượt xem TB / video" value={avgViews} min={100} max={50000} step={100} onChange={setAvgViews} />
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            <Card glass>
              <CardContent className="p-6">
                <h3 className="text-lg font-semibold text-foreground mb-4">Doanh Thu Dự Kiến</h3>
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <MetricCard label="Video / tháng" value={fmt(result.totalVideos)} unit="video" />
                  <MetricCard label="Lượt xem / tháng" value={fmt(result.totalViews)} unit="views" />
                </div>
                <div className="space-y-3">
                  <CostRow label="Doanh thu quảng cáo" value={fmtUSD(Math.round(result.monthlyRevenue * 0.8))} />
                  <CostRow label="Doanh thu affiliate" value={fmtUSD(Math.round(result.monthlyRevenue * 0.2))} />
                  <div className="border-t border-white/10 pt-3">
                    <CostRow label="Tổng doanh thu / tháng" value={fmtUSD(result.monthlyRevenue)} highlight />
                  </div>
                  <CostRow label={isLifetime ? "Trừ phí (phân bổ/tháng)" : "Trừ phí Sophia"} value={`-${fmtUSD(monthlyCost)}`} />
                  <div className="border-t border-white/10 pt-3">
                    <CostRow label="Lợi nhuận ròng / tháng" value={fmtUSD(result.monthlyProfit)} highlight />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card glass>
              <CardContent className="p-6">
                <h3 className="text-lg font-semibold text-foreground mb-4">ROI & Hoàn Vốn</h3>
                <div className="flex gap-4 mb-4">
                  <RoiBadge label="ROI" value={result.roiPercent} unit="%" good={result.roiPercent > 0} />
                  <RoiBadge label="Hoàn vốn" value={result.paybackDays} unit="ngày" good={result.paybackDays <= 30} />
                </div>
                <div className="space-y-3">
                  <CostRow label="Doanh thu / năm" value={fmtUSD(result.annualRevenue)} />
                  <CostRow label={isLifetime ? "Chi phí (trả 1 lần)" : "Chi phí Sophia / năm"} value={fmtUSD(isLifetime ? tierConfig.price : tierConfig.price * 12)} />
                  <div className="border-t border-white/10 pt-3">
                    <CostRow label="Lợi nhuận / năm" value={fmtUSD(result.annualProfit)} highlight />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card glass className="border-[var(--neon-cyan)]/30">
              <CardContent className="p-6">
                <h3 className="text-lg font-semibold text-foreground mb-2">So Với Thuê Editor Thủ Công</h3>
                <div className="text-center py-4">
                  <p className="text-xs text-muted-foreground">Thuê editor: ~$50/video × {result.totalVideos} video</p>
                  <p className="text-sm text-muted-foreground mt-1">Chi phí thủ công: {fmtUSD(result.manualCost)}/tháng</p>
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
          Ước tính dựa trên CPM trung bình $2/1,000 views và hoa hồng affiliate $0.50/100 views. Kết quả thực tế phụ thuộc vào niche, chất lượng nội dung, và chiến lược SEO của bạn.
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
