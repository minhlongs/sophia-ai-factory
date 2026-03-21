'use client';

/**
 * AARRR Funnel Component — pure CSS bars (no external chart library)
 */

import { useEffect, useState } from 'react';

interface Metric {
  label: string;
  value: number;
  description: string;
  conversionRate?: string;
}

interface AARRRMetrics {
  acquisition: Metric;
  activation: Metric;
  retention: Metric;
  revenue: Metric;
  referral: Metric;
}

const STAGE_COLORS = ['#ea580c', '#f97316', '#fb923c', '#fdba74', '#fed7aa'];

export function AARRRFunnel() {
  const [metrics, setMetrics] = useState<AARRRMetrics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchMetrics = async () => {
      try {
        const response = await fetch('/api/analytics/metrics?days=30');
        const data = await response.json();
        setMetrics(data.metrics);
      } catch (error) {
        console.error('Failed to fetch AARRR metrics:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchMetrics();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-600" />
      </div>
    );
  }

  if (!metrics) {
    return <div className="text-center text-gray-500">No data available</div>;
  }

  const stages = [
    metrics.acquisition,
    metrics.activation,
    metrics.retention,
    metrics.revenue,
    metrics.referral,
  ];
  const maxValue = Math.max(...stages.map((s) => s.value), 1);

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-medium text-gray-900">AARRR Funnel</h3>

      <div className="space-y-3">
        {stages.map((stage, i) => (
          <div key={stage.label} className="flex items-center gap-3">
            <span className="w-20 text-xs font-medium text-gray-600 text-right">
              {stage.label}
            </span>
            <div className="flex-1 bg-gray-100 rounded-full h-7 relative">
              <div
                className="h-7 rounded-full transition-all duration-700 flex items-center px-3"
                style={{
                  width: `${Math.max((stage.value / maxValue) * 100, 8)}%`,
                  backgroundColor: STAGE_COLORS[i],
                }}
              >
                <span className="text-xs font-bold text-white">{stage.value}</span>
              </div>
            </div>
            {stage.conversionRate && (
              <span className="text-xs text-gray-400 w-12">{stage.conversionRate}</span>
            )}
          </div>
        ))}
      </div>

      <p className="text-xs text-gray-400">Last 30 days</p>
    </div>
  );
}
