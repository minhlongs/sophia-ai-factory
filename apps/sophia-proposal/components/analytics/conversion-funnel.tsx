'use client';

/**
 * Conversion Funnel Component — pure CSS bars
 */

import { useEffect, useState } from 'react';

interface FunnelStage {
  name: string;
  count: number;
  conversionRate: string;
}

const FUNNEL_COLORS = ['#1e40af', '#2563eb', '#3b82f6', '#60a5fa', '#93c5fd'];

export function ConversionFunnel() {
  const [stages, setStages] = useState<FunnelStage[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchConversions = async () => {
      try {
        const response = await fetch('/api/analytics/conversions?days=30');
        const data = await response.json();
        setStages(data.stages || []);
      } catch (error) {
        console.error('Failed to fetch conversions:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchConversions();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  if (!stages.length) {
    return <div className="text-center text-gray-500">No conversion data</div>;
  }

  const maxCount = Math.max(...stages.map((s) => s.count), 1);

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-medium text-gray-900">Proposal Conversion Funnel</h3>

      <div className="space-y-2">
        {stages.map((stage, i) => (
          <div key={stage.name} className="flex items-center gap-3">
            <span className="w-20 text-xs font-medium text-gray-600 text-right truncate">
              {stage.name}
            </span>
            <div className="flex-1 bg-gray-100 rounded h-8 relative">
              <div
                className="h-8 rounded transition-all duration-700 flex items-center justify-between px-3"
                style={{
                  width: `${Math.max((stage.count / maxCount) * 100, 12)}%`,
                  backgroundColor: FUNNEL_COLORS[i % FUNNEL_COLORS.length],
                }}
              >
                <span className="text-xs font-bold text-white">{stage.count}</span>
                <span className="text-xs text-white/80">{stage.conversionRate}</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      <p className="text-xs text-gray-400">Last 30 days</p>
    </div>
  );
}
