'use client';

import { BillingStatus } from '@/components/billing/billing-status';
import { UsageChart } from '@/components/billing/usage-chart';

export default function BillingPage() {
  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Billing & Subscription</h1>
        <p className="text-gray-600 mt-1">Manage your subscription and view usage</p>
      </div>

      <BillingStatus />

      <div className="grid gap-6 md:grid-cols-2">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Usage Overview (30 days)</h2>
          <UsageChart />
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Manage Subscription</h2>
          <div className="space-y-4">
            <a
              href="/api/billing/portal"
              className="block py-3 px-4 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 text-center font-medium"
            >
              Open Customer Portal
            </a>
            <a
              href="/billing/upgrade"
              className="block py-3 px-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-center font-medium"
            >
              Upgrade Plan
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
