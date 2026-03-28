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
        <SectionHeading title="Chi Phi Van Hanh & ROI" subtitle="Tinh chinh xac chi phi san xuat video, cong suat nha may, va loi nhuan hang nam" />

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 max-w-6xl mx-auto">
          {/* Left: Controls */}
          <div className="space-y-6">
            <Card glass>
              <CardContent className="p-6 space-y-6">
                <h3 className="text-lg font-semibold text-foreground">San Luong Video</h3>
                <SliderInput label="Video / ngay" value={videosPerDay} min={1} max={100} onChange={setVideosPerDay} />
                <SliderInput label="Luong song song" value={parallelJobs} min={1} max={10} onChange={setParallelJobs} />
                <div>
                  <label className="text-foreground/80 text-sm block mb-2">Goi dich vu</label>
                  <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Goi dich vu">
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
                <h3 className="text-lg font-semibold text-foreground mb-4">Chi Phi API / Video</h3>
                <div className="space-y-3">
                  <CostRow label="HeyGen (Avatar)" value={fmtUSD(cost.components.heygen)} />
                  <CostRow label="ElevenLabs (Giong noi)" value={fmtUSD(cost.components.elevenlabs)} />
                  <CostRow label="OpenRouter (Kich ban)" value={fmtUSD(cost.components.openrouter)} />
                  <div className="border-t border-white/10 pt-3">
                    <CostRow label="Tong bien phi / video" value={fmtUSD(cost.variableCostPerVideo)} highlight />
                  </div>
                  <CostRow label="Dinh phi / thang" value={fmtUSD(cost.monthlyFixedCosts)} />
                  <div className="border-t border-white/10 pt-3">
                    <CostRow label={`Chi phi thuc / video (${fmt(videosPerMonth)} video/thang)`} value={fmtUSD(cost.totalCostPerVideo)} highlight />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right: Results */}
          <div className="space-y-6">
            <Card glass>
              <CardContent className="p-6">
                <h3 className="text-lg font-semibold text-foreground mb-4">Cong Suat Nha May</h3>
                <p className="text-xs text-muted-foreground mb-4">Toi da voi {parallelJobs} luong song song, {PRODUCTION_LIMITS.processingTimeMin} phut/video</p>
                <div className="grid grid-cols-2 gap-4">
                  <MetricCard label="/ Gio" value={fmt(throughput.videosPerHour)} unit="video" />
                  <MetricCard label="/ Ngay (24h)" value={fmt(throughput.videosPerDay)} unit="video" />
                  <MetricCard label="/ Thang (30d)" value={fmt(throughput.videosPerMonth)} unit="video" />
                  <MetricCard label="/ Nam (365d)" value={fmt(throughput.videosPerYear)} unit="video" />
                </div>
                {videosPerDay > throughput.videosPerDay && (
                  <p className="text-red-400 text-sm mt-3" role="alert">Vuot cong suat! Tang luong song song hoac giam san luong.</p>
                )}
              </CardContent>
            </Card>

            <Card glass>
              <CardContent className="p-6">
                <h3 className="text-lg font-semibold text-foreground mb-4">ROI — {tierLabels[selectedTier]}</h3>
                <div className="space-y-3">
                  <CostRow label="Doanh thu / thang" value={fmtUSD(tierROI.monthlyRevenue)} />
                  <CostRow label="Chi phi van hanh / thang" value={fmtUSD(tierROI.monthlyCost)} />
                  <div className="border-t border-white/10 pt-3"><CostRow label="Loi nhuan / thang" value={fmtUSD(tierROI.monthlyProfit)} highlight /></div>
                  <CostRow label="Doanh thu / nam (ARR)" value={fmtUSD(tierROI.annualRevenue)} />
                  <CostRow label="Chi phi / nam" value={fmtUSD(tierROI.annualCost)} />
                  <div className="border-t border-white/10 pt-3"><CostRow label="Loi nhuan / nam" value={fmtUSD(tierROI.annualProfit)} highlight /></div>
                </div>
                <div className="flex gap-4 mt-6">
                  <MarginBadge label="Bien loi nhuan" value={tierROI.marginPercent} threshold={50} unit="%" />
                  <MarginBadge label="ROI" value={tierROI.roiPercent} threshold={100} unit="%" />
                </div>
              </CardContent>
            </Card>

            <Card glass className="border-[var(--neon-cyan)]/30">
              <CardContent className="p-6">
                <h3 className="text-lg font-semibold text-foreground mb-2">Du Bao ARR (10 khach {tierLabels[selectedTier]})</h3>
                <div className="text-center py-4">
                  <p className="text-xs text-muted-foreground">Doanh thu hang nam</p>
                  <p className="text-4xl font-bold bg-gradient-to-r from-[var(--neon-cyan)] to-[var(--neon-purple)] bg-clip-text text-transparent">{fmtUSD(arrProjection.arr)}</p>
                  <p className="text-sm text-muted-foreground mt-2">Chi phi: {fmtUSD(arrProjection.annualCost)} | Loi nhuan: {fmtUSD(arrProjection.annualProfit)} | Margin: {arrProjection.marginPercent}%</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        <p className="text-center text-muted-foreground text-xs mt-8 max-w-3xl mx-auto">
          Chi phi API dua tren bang gia HeyGen Scale ($0.50/phut), ElevenLabs Creator ($22/thang), OpenRouter Haiku ($0.008/script). Dinh phi: HeyGen $99 + ElevenLabs $22 = $121/thang. San luong thuc te phu thuoc vao rate limit cua API va do dai video.
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
