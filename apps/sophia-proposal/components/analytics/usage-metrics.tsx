'use client';

/**
 * Usage Metrics Component — pure CSS charts
 */

import { useEffect, useState } from 'react';

interface UsageData {
  totalMCU: number;
  proposalsGenerated: number;
  videosCreated: number;
  avgMCUPerProposal: number;
  dailyTrend: { date: string; mcu: number }[];
}

export function UsageMetrics() {
  const [usage, setUsage] = useState<UsageData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchUsage = async () => {
      try {
        const response = await fetch('/api/analytics/usage?days=30');
        const data = await response.json();
        setUsage(data);
      } catch (error) {
        console.error('Failed to fetch usage:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchUsage();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-600" />
      </div>
    );
  }

  if (!usage) {
    return <div className="text-center text-gray-500">No usage data</div>;
  }

  const maxMCU = Math.max(...(usage.dailyTrend?.map((d) => d.mcu) || [1]), 1);

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-medium text-gray-900">Usage Metrics</h3>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-3">
        {[
          { label: 'Total MCU', value: usage.totalMCU.toLocaleString(), color: 'orange' },
          { label: 'Proposals', value: usage.proposalsGenerated.toString(), color: 'blue' },
          { label: 'Videos', value: usage.videosCreated.toString(), color: 'purple' },
          { label: 'Avg MCU/Proposal', value: usage.avgMCUPerProposal.toFixed(1), color: 'green' },
        ].map((card) => (
          <div key={card.label} className="bg-gray-50 rounded-lg p-3">
            <p className="text-xs text-gray-500">{card.label}</p>
            <p className={`text-xl font-bold text-${card.color}-600`}>{card.value}</p>
          </div>
        ))}
      </div>

      {/* Daily trend — sparkline-style bars */}
      {usage.dailyTrend && usage.dailyTrend.length > 0 && (
        <div>
          <p className="text-xs text-gray-500 mb-2">Daily MCU Usage (30d)</p>
          <div className="flex items-end gap-px h-20">
            {usage.dailyTrend.map((day) => (
              <div
                key={day.date}
                className="flex-1 bg-orange-400 hover:bg-orange-600 rounded-t transition-colors cursor-pointer"
                style={{ height: `${Math.max((day.mcu / maxMCU) * 100, 4)}%` }}
                title={`${day.date}: ${day.mcu} MCU`}
              />
            ))}
          </div>
          <div className="flex justify-between text-[10px] text-gray-400 mt-1">
            <span>{usage.dailyTrend[0]?.date}</span>
            <span>{usage.dailyTrend[usage.dailyTrend.length - 1]?.date}</span>
          </div>
        </div>
      )}
    </div>
  );
}
