"use client";

import dynamic from "next/dynamic";
import { TrendingUp, Activity, CheckCircle2 } from "lucide-react";

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
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      {/* Total Campaigns */}
      <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-500 mb-1">Total Campaigns</p>
            <div className="text-3xl font-bold text-gray-900">
              <AnimatedCounter value={totalCampaigns} duration={1.5} />
            </div>
          </div>
          <div className="w-12 h-12 bg-blue-50 rounded-lg flex items-center justify-center">
            <TrendingUp className="w-6 h-6 text-blue-600" />
          </div>
        </div>
      </div>

      {/* Active Campaigns */}
      <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-500 mb-1">Active Campaigns</p>
            <div className="text-3xl font-bold text-gray-900">
              <AnimatedCounter value={activeCampaigns} duration={1.5} />
            </div>
          </div>
          <div className="w-12 h-12 bg-purple-50 rounded-lg flex items-center justify-center">
            <Activity className="w-6 h-6 text-purple-600" />
          </div>
        </div>
      </div>

      {/* Completed Campaigns */}
      <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-500 mb-1">Completed</p>
            <div className="text-3xl font-bold text-gray-900">
              <AnimatedCounter value={completedCampaigns} duration={1.5} />
            </div>
          </div>
          <div className="w-12 h-12 bg-green-50 rounded-lg flex items-center justify-center">
            <CheckCircle2 className="w-6 h-6 text-green-600" />
          </div>
        </div>
      </div>
    </div>
  );
}
