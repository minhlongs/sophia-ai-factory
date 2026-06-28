"use client";

import dynamic from "next/dynamic";
import { TrendingUp, Activity, CheckCircle2, AlertCircle, FileText } from "lucide-react";
import { useTranslations } from 'next-intl';
import { cn } from '@/seed/utils/cn';

const AnimatedCounter = dynamic(
  () => import("@/seed/components/ui/animated-counter-with-framer-motion").then(mod => ({ default: mod.AnimatedCounter })),
  { ssr: false, loading: () => <span>0</span> }
);

interface DashboardStatsProps {
  totalCampaigns: number;
  activeCampaigns: number;
  completedCampaigns: number;
  failedCampaigns?: number;
  draftCampaigns?: number;
}

export function DashboardStats({
  totalCampaigns,
  activeCampaigns,
  completedCampaigns,
  failedCampaigns = 0,
  draftCampaigns = 0,
}: DashboardStatsProps) {
  const t = useTranslations('dashboard.stats');

  // Determine which stats to show based on values (if draft/failed > 0, show 4-column grid)
  const showAllStats = failedCampaigns > 0 || draftCampaigns > 0;

  return (
    <div className={cn(
      "grid gap-6",
      showAllStats
        ? "grid-cols-2 md:grid-cols-4"
        : "grid-cols-1 md:grid-cols-3"
    )}>
      {/* Total Campaigns */}
      <StatCard
        icon={<TrendingUp className="w-6 h-6 text-blue-600 dark:text-blue-400" aria-hidden="true" />}
        iconBg="bg-blue-50 dark:bg-blue-900/20"
        label={t('total_campaigns')}
        value={totalCampaigns}
        accent="blue"
      />

      {/* Active Campaigns */}
      <StatCard
        icon={<Activity className="w-6 h-6 text-purple-600 dark:text-purple-400" aria-hidden="true" />}
        iconBg="bg-purple-50 dark:bg-purple-900/20"
        label={t('active_campaigns')}
        value={activeCampaigns}
        accent="purple"
      />

      {/* Completed Campaigns */}
      <StatCard
        icon={<CheckCircle2 className="w-6 h-6 text-green-600 dark:text-green-400" aria-hidden="true" />}
        iconBg="bg-green-50 dark:bg-green-900/20"
        label={t('completed_campaigns')}
        value={completedCampaigns}
        accent="green"
      />

      {/* Failed Campaigns (conditionally shown) */}
      {failedCampaigns > 0 && (
        <StatCard
          icon={<AlertCircle className="w-6 h-6 text-red-600 dark:text-red-400" aria-hidden="true" />}
          iconBg="bg-red-50 dark:bg-red-900/20"
          label={t('failed_campaigns')}
          value={failedCampaigns}
          accent="red"
        />
      )}

      {/* Draft Campaigns (conditionally shown) */}
      {draftCampaigns > 0 && (
        <StatCard
          icon={<FileText className="w-6 h-6 text-amber-600 dark:text-amber-400" aria-hidden="true" />}
          iconBg="bg-amber-50 dark:bg-amber-900/20"
          label={t('draft_campaigns')}
          value={draftCampaigns}
          accent="amber"
        />
      )}
    </div>
  );
}

interface StatCardProps {
  icon: React.ReactNode;
  iconBg: string;
  label: string;
  value: number;
  accent: 'blue' | 'purple' | 'green' | 'red' | 'amber';
}

function StatCard({ icon, iconBg, label, value, accent }: StatCardProps) {
  return (
    <div className="bg-card p-6 rounded-xl border border-border shadow-sm">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-muted-foreground mb-1">{label}</p>
          <div className="text-3xl font-bold text-foreground">
            <AnimatedCounter value={value} duration={1.5} />
          </div>
        </div>
        <div className={cn("w-12 h-12 rounded-lg flex items-center justify-center", iconBg)}>
          {icon}
        </div>
      </div>
    </div>
  );
}
