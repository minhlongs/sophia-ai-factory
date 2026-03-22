/**
 * Dashboard Usage Page — MCU balance + command breakdown with date filter.
 */

import { UsageDashboard } from '@/components/dashboard/usage-dashboard';

export const metadata = {
  title: 'Usage — Dashboard',
};

export default function UsagePage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Usage</h1>
        <p className="mt-1 text-sm text-gray-500">
          MCU balance and consumption breakdown by command type.
        </p>
      </div>
      <UsageDashboard />
    </div>
  );
}
