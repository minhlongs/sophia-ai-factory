"use client";

import { useTranslations } from "next-intl";
import { Card, CardContent } from "@/seed/components/ui/card";
import { API_COSTS, INFRA_COSTS } from "@/land/billing/video-production-cost-engine";
import { CostRow, MetricCard, fmt, fmtUSD } from "./production-cost-calculator-parts";

interface CostResult {
  totalVideos: number; totalViews: number;
  adRevenue: number; affiliateRevenue: number; affiliateSales: number;
  leadRevenue: number; leads: number; monthlyRevenue: number;
  monthlyProfit: number; totalMonthlyCost: number;
  manualCost: number; savings: number;
  paybackDays: number; roiPercent: number;
  annualRevenue: number; annualProfit: number;
}

function RoiBadge({ label, value, unit, good }: { label: string; value: number; unit: string; good: boolean }) {
  return (
    <div className={`flex-1 text-center p-3 rounded-lg ${good ? "bg-green-500/10" : "bg-red-500/10"}`}>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`text-2xl font-bold ${good ? "text-green-400" : "text-red-400"}`}>{fmt(value)} {unit}</p>
    </div>
  );
}

export function CostResultPanel({ result, isLifetime, monthlyCost, avgCommission }: {
  result: CostResult; isLifetime: boolean; monthlyCost: number; avgCommission: number;
}) {
  const t = useTranslations("landing.roi");

  return (
    <div className="space-y-6">
      <Card className="bg-zinc-900/60 backdrop-blur-xl border-zinc-800">
        <CardContent className="p-6">
          <h3 className="text-lg font-semibold text-white mb-4">{t("revenue_by_source")}</h3>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <MetricCard label={t("videos_month")} value={fmt(result.totalVideos)} unit="video" />
            <MetricCard label={t("views_month")} value={fmt(result.totalViews)} unit="views" />
          </div>
          <div className="space-y-3">
            <CostRow label="YouTube Ads (CPM)" value={fmtUSD(result.adRevenue)} />
            <CostRow label={`Affiliate SaaS (${result.affiliateSales} × $${avgCommission})`} value={fmtUSD(result.affiliateRevenue)} />
            <CostRow label={`Lead Gen (${result.leads} leads)`} value={fmtUSD(result.leadRevenue)} />
            <div className="border-t border-zinc-800 pt-3">
              <CostRow label={t("total_revenue")} value={fmtUSD(result.monthlyRevenue)} highlight />
            </div>
            <div className="border-t border-zinc-800 pt-3 space-y-2">
              <p className="text-xs text-muted-foreground font-medium">{t("operating_costs")}</p>
              <CostRow label={isLifetime ? `Sophia License (${t("lifetime_suffix")} ÷ 12)` : "Sophia License"} value={`-${fmtUSD(monthlyCost)}`} />
              <CostRow label={`HeyGen ($${API_COSTS.heygen.perMinute}/video + $${API_COSTS.heygen.monthlyFixed}/mo)`} value={`-${fmtUSD(result.totalVideos * API_COSTS.heygen.perMinute + API_COSTS.heygen.monthlyFixed)}`} />
              <CostRow label={`ElevenLabs ($${API_COSTS.elevenlabs.perScript}/video + $${API_COSTS.elevenlabs.monthlyFixed}/mo)`} value={`-${fmtUSD(result.totalVideos * API_COSTS.elevenlabs.perScript + API_COSTS.elevenlabs.monthlyFixed)}`} />
              <CostRow label={`OpenRouter ($${API_COSTS.openrouter.perScript}/script)`} value={`-${fmtUSD(result.totalVideos * API_COSTS.openrouter.perScript)}`} />
              <CostRow label={`Inngest ($${INFRA_COSTS.inngest}/mo)`} value={`-${fmtUSD(INFRA_COSTS.inngest)}`} />
              <CostRow label="Cloud + Redis + Email" value={`-${fmtUSD(INFRA_COSTS.cloudflareWorkers + INFRA_COSTS.domain + INFRA_COSTS.cloudflareR2 + INFRA_COSTS.upstashRedis + INFRA_COSTS.resend)}`} />
              <CostRow label={t("total_costs")} value={`-${fmtUSD(result.totalMonthlyCost)}`} highlight />
            </div>
            <div className="border-t border-zinc-800 pt-3">
              <CostRow label={t("net_profit")} value={fmtUSD(result.monthlyProfit)} highlight />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-zinc-900/60 backdrop-blur-xl border-zinc-800">
        <CardContent className="p-6">
          <h3 className="text-lg font-semibold text-white mb-4">{t("roi_payback")}</h3>
          <div className="flex gap-4 mb-4">
            <RoiBadge label={t("roi_label")} value={result.roiPercent} unit="%" good={result.roiPercent > 0} />
            <RoiBadge label={t("payback_label")} value={result.paybackDays} unit={t("days")} good={result.paybackDays <= 30} />
          </div>
          <div className="space-y-3">
            <CostRow label={t("annual_revenue")} value={fmtUSD(result.annualRevenue)} />
            <CostRow label={t("annual_costs")} value={fmtUSD(result.totalMonthlyCost * 12)} />
            <div className="border-t border-zinc-800 pt-3">
              <CostRow label={t("annual_profit")} value={fmtUSD(result.annualProfit)} highlight />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-zinc-900/60 backdrop-blur-xl border-indigo-500/30">
        <CardContent className="p-6">
          <h3 className="text-lg font-semibold text-white mb-2">{t("vs_manual")}</h3>
          <div className="text-center py-4">
            <p className="text-xs text-muted-foreground">
              {t("manual_cost_desc", { totalVideos: result.totalVideos, manualCost: fmtUSD(result.manualCost) })}
            </p>
            <p className="text-4xl font-bold bg-gradient-to-r from-indigo-400 to-indigo-300 bg-clip-text text-transparent mt-3">
              {t("savings_monthly", { amount: fmtUSD(result.savings) })}
            </p>
            <p className="text-sm text-muted-foreground mt-2">
              {t("savings_annual", { amount: fmtUSD(result.savings * 12) })}
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
