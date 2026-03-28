"use client";

import { Container } from "@/components/ui/container";
import { Card, CardContent } from "@/components/ui/card";
import { SectionHeading } from "@/components/ui/section-heading";
import { useState, useMemo } from "react";
import {
  calculateCostBreakdown,
  calculateThroughput,
  calculateTierROI,
  calculateARRProjection,
  PRODUCTION_LIMITS,
} from "@/lib/billing/video-production-cost-engine";
import { UNIFIED_TIERS } from "@/lib/unified-tier-config";
import type { Tier } from "@/types";
import { SliderInput, CostRow, MetricCard, fmt, fmtUSD } from "./production-cost-calculator-parts";

const tiers = Object.keys(UNIFIED_TIERS) as Tier[];
const tierLabels = Object.fromEntries(
  tiers.map(t => [t, `${UNIFIED_TIERS[t].name} ($${UNIFIED_TIERS[t].price.toLocaleString()})`])
) as Record<Tier, string>;

export function ProductionCostCalculator() {
  const [videosPerDay, setVideosPerDay] = useState(20);
  const [parallelJobs, setParallelJobs] = useState(PRODUCTION_LIMITS.maxParallelJobs);
  const [selectedTier, setSelectedTier] = useState<Tier>("PREMIUM");

  const videosPerMonth = videosPerDay * 30;
  const cost = useMemo(() => calculateCostBreakdown(videosPerMonth), [videosPerMonth]);
  const throughput = useMemo(() => calculateThroughput(parallelJobs), [parallelJobs]);
  const tierROI = useMemo(() => calculateTierROI(selectedTier, videosPerMonth), [selectedTier, videosPerMonth]);
  const arrProjection = useMemo(() => {
    const mix = Object.fromEntries(tiers.map(t => [t, 0])) as Record<Tier, number>;
    mix[selectedTier] = 10;
    return calculateARRProjection(mix);
  }, [selectedTier]);

  return (
    <section id="cost-calculator" className="py-20 md:py-32 relative">
      <Container>
        <SectionHeading title="Chi Phí Vận Hành & ROI" subtitle="Tính chính xác chi phí sản xuất video, công suất nhà máy, và lợi nhuận hàng năm" />

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 max-w-6xl mx-auto">
          {/* Left: Controls */}
          <div className="space-y-6">
            <Card glass>
              <CardContent className="p-6 space-y-6">
                <h3 className="text-lg font-semibold text-foreground">Sản Lượng Video</h3>
                <SliderInput label="Video / ngày" value={videosPerDay} min={1} max={100} onChange={setVideosPerDay} />
                <SliderInput label="Luồng song song" value={parallelJobs} min={1} max={10} onChange={setParallelJobs} />
                <div>
                  <label className="text-foreground/80 text-sm block mb-2">Gói dịch vụ</label>
                  <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Gói dịch vụ">
                    {tiers.map((t) => (
                      <button key={t} role="radio" aria-checked={selectedTier === t} onClick={() => setSelectedTier(t)}
                        className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${selectedTier === t ? "bg-[var(--neon-cyan)]/20 border border-[var(--neon-cyan)] text-[var(--neon-cyan)]" : "bg-white/5 border border-white/10 text-muted-foreground hover:bg-white/10"}`}>
                        {tierLabels[t]}
                      </button>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card glass>
              <CardContent className="p-6">
                <h3 className="text-lg font-semibold text-foreground mb-4">Chi Phí API / Video</h3>
                <div className="space-y-3">
                  <CostRow label="HeyGen (Avatar)" value={fmtUSD(cost.components.heygen)} />
                  <CostRow label="ElevenLabs (Giọng nói)" value={fmtUSD(cost.components.elevenlabs)} />
                  <CostRow label="OpenRouter (Kịch bản)" value={fmtUSD(cost.components.openrouter)} />
                  <div className="border-t border-white/10 pt-3">
                    <CostRow label="Tổng biến phí / video" value={fmtUSD(cost.variableCostPerVideo)} highlight />
                  </div>
                  <CostRow label="Định phí / tháng" value={fmtUSD(cost.monthlyFixedCosts)} />
                  <div className="border-t border-white/10 pt-3">
                    <CostRow label={`Chi phí thực / video (${fmt(videosPerMonth)} video/tháng)`} value={fmtUSD(cost.totalCostPerVideo)} highlight />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right: Results */}
          <div className="space-y-6">
            <Card glass>
              <CardContent className="p-6">
                <h3 className="text-lg font-semibold text-foreground mb-4">Công Suất Nhà Máy</h3>
                <p className="text-xs text-muted-foreground mb-4">Tối đa với {parallelJobs} luồng song song, {PRODUCTION_LIMITS.processingTimeMin} phút/video</p>
                <div className="grid grid-cols-2 gap-4">
                  <MetricCard label="/ Giờ" value={fmt(throughput.videosPerHour)} unit="video" />
                  <MetricCard label="/ Ngày (24h)" value={fmt(throughput.videosPerDay)} unit="video" />
                  <MetricCard label="/ Tháng (30d)" value={fmt(throughput.videosPerMonth)} unit="video" />
                  <MetricCard label="/ Năm (365d)" value={fmt(throughput.videosPerYear)} unit="video" />
                </div>
                {videosPerDay > throughput.videosPerDay && (
                  <p className="text-red-400 text-sm mt-3" role="alert">Vượt công suất! Tăng luồng song song hoặc giảm sản lượng.</p>
                )}
              </CardContent>
            </Card>

            <Card glass>
              <CardContent className="p-6">
                <h3 className="text-lg font-semibold text-foreground mb-4">ROI — {tierLabels[selectedTier]}</h3>
                <div className="space-y-3">
                  <CostRow label="Doanh thu / tháng" value={fmtUSD(tierROI.monthlyRevenue)} />
                  <CostRow label="Chi phí vận hành / tháng" value={fmtUSD(tierROI.monthlyCost)} />
                  <div className="border-t border-white/10 pt-3"><CostRow label="Lợi nhuận / tháng" value={fmtUSD(tierROI.monthlyProfit)} highlight /></div>
                  <CostRow label="Doanh thu / năm (ARR)" value={fmtUSD(tierROI.annualRevenue)} />
                  <CostRow label="Chi phí / năm" value={fmtUSD(tierROI.annualCost)} />
                  <div className="border-t border-white/10 pt-3"><CostRow label="Lợi nhuận / năm" value={fmtUSD(tierROI.annualProfit)} highlight /></div>
                </div>
                <div className="flex gap-4 mt-6">
                  <MarginBadge label="Biên lợi nhuận" value={tierROI.marginPercent} threshold={50} unit="%" />
                  <MarginBadge label="ROI" value={tierROI.roiPercent} threshold={100} unit="%" />
                </div>
              </CardContent>
            </Card>

            <Card glass className="border-[var(--neon-cyan)]/30">
              <CardContent className="p-6">
                <h3 className="text-lg font-semibold text-foreground mb-2">Dự Báo ARR (10 khách {tierLabels[selectedTier]})</h3>
                <div className="text-center py-4">
                  <p className="text-xs text-muted-foreground">Doanh thu hàng năm</p>
                  <p className="text-4xl font-bold bg-gradient-to-r from-[var(--neon-cyan)] to-[var(--neon-purple)] bg-clip-text text-transparent">{fmtUSD(arrProjection.arr)}</p>
                  <p className="text-sm text-muted-foreground mt-2">Chi phí: {fmtUSD(arrProjection.annualCost)} | Lợi nhuận: {fmtUSD(arrProjection.annualProfit)} | Margin: {arrProjection.marginPercent}%</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        <p className="text-center text-muted-foreground text-xs mt-8 max-w-3xl mx-auto">
          Chi phí API dựa trên bảng giá HeyGen Scale ($0.50/phút), ElevenLabs Creator ($22/tháng), OpenRouter Haiku ($0.008/script). Định phí: HeyGen $99 + ElevenLabs $22 = $121/tháng. Sản lượng thực tế phụ thuộc vào rate limit của API và độ dài video.
        </p>
      </Container>
    </section>
  );
}

function MarginBadge({ label, value, threshold, unit }: { label: string; value: number; threshold: number; unit: string }) {
  const color = value > threshold ? "green" : value > 0 ? "yellow" : "red";
  return (
    <div className={`flex-1 text-center p-3 rounded-lg bg-${color}-500/10`}>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`text-2xl font-bold text-${color}-400`}>{value}{unit}</p>
    </div>
  );
}
