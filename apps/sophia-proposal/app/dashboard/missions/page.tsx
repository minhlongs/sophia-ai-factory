/**
 * Dashboard Missions Page — filterable mission list with expandable details.
 */

import { MissionsList } from '@/components/dashboard/missions-list';

export const metadata = {
  title: 'Missions — Dashboard',
};

export default function MissionsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Missions</h1>
        <p className="mt-1 text-sm text-gray-500">
          AI-powered tasks run via OpenClaw RaaS. Click a row to expand details.
        </p>
      </div>
      <MissionsList />
    </div>
  );
}
