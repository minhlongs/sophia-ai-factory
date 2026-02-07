"use client";

import dynamic from "next/dynamic";
import { TrendingUp, Activity, CheckCircle2 } from "lucide-react";
import { useTranslations } from 'next-intl';

const AnimatedCounter = dynamic(
  () => import("@/components/ui/animated-counter-with-framer-motion").then(mod => ({ default: mod.AnimatedCounter })),
  { ssr: false, loading: () => <span>0</span> }
);

interface DashboardStatsProps {
  totalCampaigns: number;
  activeCampaigns: number;
  completedCampaigns: number;
}

export function DashboardStats({
  totalCampaigns,
  activeCampaigns,
  completedCampaigns,
}: DashboardStatsProps) {
  const t = useTranslations('dashboard.stats');

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      {/* Total Campaigns */}
      <div className="bg-card p-6 rounded-xl border border-border shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground mb-1">{t('total_campaigns')}</p>
            <div className="text-3xl font-bold text-foreground">
              <AnimatedCounter value={totalCampaigns} duration={1.5} />
            </div>
          </div>
          <div className="w-12 h-12 bg-blue-50 dark:bg-blue-900/20 rounded-lg flex items-center justify-center">
            <TrendingUp className="w-6 h-6 text-blue-600 dark:text-blue-400" />
          </div>
        </div>
      </div>

      {/* Active Campaigns */}
      <div className="bg-card p-6 rounded-xl border border-border shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground mb-1">{t('active_campaigns')}</p>
            <div className="text-3xl font-bold text-foreground">
              <AnimatedCounter value={activeCampaigns} duration={1.5} />
            </div>
          </div>
          <div className="w-12 h-12 bg-purple-50 dark:bg-purple-900/20 rounded-lg flex items-center justify-center">
            <Activity className="w-6 h-6 text-purple-600 dark:text-purple-400" />
          </div>
        </div>
      </div>

      {/* Completed Campaigns */}
      <div className="bg-card p-6 rounded-xl border border-border shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground mb-1">{t('completed_campaigns')}</p>
            <div className="text-3xl font-bold text-foreground">
              <AnimatedCounter value={completedCampaigns} duration={1.5} />
            </div>
          </div>
          <div className="w-12 h-12 bg-green-50 dark:bg-green-900/20 rounded-lg flex items-center justify-center">
            <CheckCircle2 className="w-6 h-6 text-green-600 dark:text-green-400" />
          </div>
        </div>
      </div>
    </div>
  );
}
