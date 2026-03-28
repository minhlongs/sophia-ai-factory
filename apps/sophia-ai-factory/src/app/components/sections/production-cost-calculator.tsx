"use client";

import { Container } from "@/components/ui/container";
import { Card, CardContent } from "@/components/ui/card";
import { SectionHeading } from "@/components/ui/section-heading";
import { useState, useMemo } from "react";
import { UNIFIED_TIERS } from "@/lib/unified-tier-config";
import type { Tier } from "@/types";
import { SliderInput, CostRow, MetricCard, fmt, fmtUSD } from "./production-cost-calculator-parts";

const tiers = Object.keys(UNIFIED_TIERS) as Tier[];
const tierLabels = Object.fromEntries(
  tiers.map(t => [t, `${UNIFIED_TIERS[t].name} ($${UNIFIED_TIERS[t].price.toLocaleString()})`])
) as Record<Tier, string>;

/** Revenue per 1,000 views (YouTube CPM average) */
const AD_CPM = 2.0;
/** Affiliate commission per 100 views */
const AFFILIATE_PER_100 = 0.5;
/** Average cost to hire a video editor per video (USD) */
const MANUAL_COST_PER_VIDEO = 50;

export function ProductionCostCalculator() {
  const [selectedTier, setSelectedTier] = useState<Tier>("PREMIUM");
  const [channels, setChannels] = useState(3);
  const [videosPerWeek, setVideosPerWeek] = useState(10);
  const [avgViews, setAvgViews] = useState(1000);

  const tierConfig = UNIFIED_TIERS[selectedTier];
  const subscriptionCost = tierConfig.price;

  const result = useMemo(() => {
    const totalVideos = channels * videosPerWeek * 4;
    const totalViews = totalVideos * avgViews;
    const adRevenue = (totalViews / 1000) * AD_CPM;
    const affiliateRevenue = (totalViews / 100) * AFFILIATE_PER_100;
    const monthlyRevenue = adRevenue + affiliateRevenue;
    const monthlyProfit = monthlyRevenue - subscriptionCost;
    const manualCost = totalVideos * MANUAL_COST_PER_VIDEO;
    const savings = manualCost - subscriptionCost;
    const paybackDays = monthlyRevenue > 0 ? Math.ceil((subscriptionCost / monthlyRevenue) * 30) : 999;
    const roiPercent = subscriptionCost > 0 ? ((monthlyRevenue - subscriptionCost) / subscriptionCost) * 100 : 0;
    const annualRevenue = monthlyRevenue * 12;
    const annualProfit = monthlyProfit * 12;

    return {
      totalVideos, totalViews, monthlyRevenue: Math.round(monthlyRevenue),
      monthlyProfit: Math.round(monthlyProfit), manualCost: Math.round(manualCost),
      savings: Math.round(savings), paybackDays, roiPercent: Math.round(roiPercent),
      annualRevenue: Math.round(annualRevenue), annualProfit: Math.round(annualProfit),
      costPerVideo: totalVideos > 0 ? Math.round((subscriptionCost / totalVideos) * 100) / 100 : 0,
    };
  }, [channels, videosPerWeek, avgViews, subscriptionCost]);

  return (
    <section id="cost-calculator" className="py-20 md:py-32 relative">
      <Container>
        <SectionHeading
          title="Tính ROI Cho Doanh Nghiệp Của Bạn"
          subtitle="Xem bạn tiết kiệm bao nhiêu và kiếm được bao nhiêu khi dùng Sophia AI Factory"
        />

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 max-w-6xl mx-auto">
          {/* Left: Inputs */}
          <div className="space-y-6">
            <Card glass>
              <CardContent className="p-6 space-y-6">
                <h3 className="text-lg font-semibold text-foreground">Thông Tin Kênh Của Bạn</h3>
                <SliderInput label="Số kênh YouTube" value={channels} min={1} max={10} onChange={setChannels} />
                <SliderInput label="Video / tuần" value={videosPerWeek} min={1} max={30} onChange={setVideosPerWeek} />
                <SliderInput label="Lượt xem trung bình / video" value={avgViews} min={100} max={10000} step={100} onChange={setAvgViews} />
              </CardContent>
            </Card>

            <Card glass>
              <CardContent className="p-6">
                <h3 className="text-lg font-semibold text-foreground mb-4">Chọn Gói Sophia</h3>
                <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Gói dịch vụ">
                  {tiers.map((t) => (
                    <button key={t} role="radio" aria-checked={selectedTier === t} onClick={() => setSelectedTier(t)}
                      className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${selectedTier === t ? "bg-[var(--neon-cyan)]/20 border border-[var(--neon-cyan)] text-[var(--neon-cyan)]" : "bg-white/5 border border-white/10 text-muted-foreground hover:bg-white/10"}`}>
                      {tierLabels[t]}
                    </button>
                  ))}
                </div>

                <div className="mt-4 space-y-2">
                  <CostRow label="Phí Sophia / tháng" value={fmtUSD(subscriptionCost)} highlight />
                  <CostRow label="Chi phí / video" value={fmtUSD(result.costPerVideo)} />
                  <CostRow label="Video tối đa / tháng" value={`${tierConfig.campaignsPerMonth}`} />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right: Results */}
          <div className="space-y-6">
            {/* Revenue projection */}
            <Card glass>
              <CardContent className="p-6">
                <h3 className="text-lg font-semibold text-foreground mb-4">Doanh Thu Dự Kiến</h3>
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <MetricCard label="Video / tháng" value={fmt(result.totalVideos)} unit="video" />
                  <MetricCard label="Lượt xem / tháng" value={fmt(result.totalViews)} unit="views" />
                </div>
                <div className="space-y-3">
                  <CostRow label="Doanh thu quảng cáo" value={fmtUSD(result.monthlyRevenue * 0.8)} />
                  <CostRow label="Doanh thu affiliate" value={fmtUSD(result.monthlyRevenue * 0.2)} />
                  <div className="border-t border-white/10 pt-3">
                    <CostRow label="Tổng doanh thu / tháng" value={fmtUSD(result.monthlyRevenue)} highlight />
                  </div>
                  <CostRow label="Trừ phí Sophia" value={`-${fmtUSD(subscriptionCost)}`} />
                  <div className="border-t border-white/10 pt-3">
                    <CostRow label="Lợi nhuận ròng / tháng" value={fmtUSD(result.monthlyProfit)} highlight />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* ROI & Payback */}
            <Card glass>
              <CardContent className="p-6">
                <h3 className="text-lg font-semibold text-foreground mb-4">ROI & Hoàn Vốn</h3>
                <div className="flex gap-4 mb-4">
                  <RoiBadge label="ROI" value={result.roiPercent} unit="%" good={result.roiPercent > 0} />
                  <RoiBadge label="Hoàn vốn" value={result.paybackDays} unit="ngày" good={result.paybackDays <= 30} />
                </div>
                <div className="space-y-3">
                  <CostRow label="Doanh thu / năm" value={fmtUSD(result.annualRevenue)} />
                  <CostRow label="Chi phí Sophia / năm" value={fmtUSD(subscriptionCost * 12)} />
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
                  <p className="text-xs text-muted-foreground">Thuê editor: ~$50/video × {result.totalVideos} video</p>
                  <p className="text-sm text-muted-foreground mt-1">Chi phí thủ công: {fmtUSD(result.manualCost)}/tháng</p>
                  <p className="text-4xl font-bold bg-gradient-to-r from-[var(--neon-cyan)] to-[var(--neon-purple)] bg-clip-text text-transparent mt-3">
                    Tiết kiệm {fmtUSD(result.savings)}/tháng
                  </p>
                  <p className="text-sm text-muted-foreground mt-2">
                    = {fmtUSD(result.savings * 12)}/năm so với thuê người làm
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        <p className="text-center text-muted-foreground text-xs mt-8 max-w-3xl mx-auto">
          Ước tính dựa trên CPM trung bình $2/1000 views và hoa hồng affiliate $0.50/100 views.
          Kết quả thực tế phụ thuộc vào niche, chất lượng nội dung, và chiến lược SEO của bạn.
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
