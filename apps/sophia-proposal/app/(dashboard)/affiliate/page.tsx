/**
 * Affiliate Dashboard Page
 * Route: /affiliate
 */

import { AffiliateDashboard } from '@/components/affiliate/affiliate-dashboard';

export const metadata = {
  title: 'Affiliate Engine — Sophia AI Factory',
  description: 'Manage affiliate programs, generate content, and track clicks.',
};

export default function AffiliatePage() {
  return (
    <main className="min-h-screen bg-gray-50">
      <div className="max-w-5xl mx-auto py-8 px-4">
        <AffiliateDashboard />
      </div>
    </main>
  );
}
