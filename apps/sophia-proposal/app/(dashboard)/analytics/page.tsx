'use client';

/**
 * Analytics Dashboard Page
 *
 * Main dashboard for AARRR, conversions, and usage metrics
 */

import { AARRRFunnel } from '@/components/analytics/aarrr-funnel';
import { ConversionFunnel } from '@/components/analytics/conversion-funnel';
import { UsageMetrics } from '@/components/analytics/usage-metrics';

export default function AnalyticsPage() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Analytics</h1>
        <div className="flex items-center space-x-2">
          <select className="border border-gray-300 rounded-md px-3 py-1.5 text-sm">
            <option>Last 7 days</option>
            <option>Last 30 days</option>
            <option>Last 90 days</option>
          </select>
          <button className="px-4 py-1.5 bg-orange-600 text-white text-sm font-medium rounded-md hover:bg-orange-700">
            Export
          </button>
        </div>
      </div>

      {/* Main Metrics Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* AARRR Funnel */}
        <div className="bg-white rounded-lg shadow p-6">
          <AARRRFunnel />
        </div>

        {/* Proposal Conversion */}
        <div className="bg-white rounded-lg shadow p-6">
          <ConversionFunnel />
        </div>
      </div>

      {/* Usage Metrics - Full Width */}
      <div className="bg-white rounded-lg shadow p-6">
        <UsageMetrics />
      </div>
    </div>
  );
}
