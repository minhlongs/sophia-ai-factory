'use client';

import { PlanCard } from '@/components/billing/plan-card';
import { POLAR_TIERS } from '@/lib/billing/polar-client';

export default function UpgradePage() {
  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Choose Your Plan</h1>
        <p className="text-gray-600 mt-1">Select the plan that fits your needs</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        {Object.keys(POLAR_TIERS).map((tier) => (
          <PlanCard
            key={tier}
            tierName={tier as keyof typeof POLAR_TIERS}
            onSelect={() => {}}
          />
        ))}
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mt-8">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Need Help Choosing?</h2>
        <div className="grid md:grid-cols-3 gap-4 text-sm">
          <div>
            <h3 className="font-semibold text-gray-900 mb-2">Starter</h3>
            <p className="text-gray-600">Perfect for small teams and startups getting started with AI-powered proposals.</p>
          </div>
          <div>
            <h3 className="font-semibold text-gray-900 mb-2">Growth</h3>
            <p className="text-gray-600">For growing businesses that need more capacity and advanced features.</p>
          </div>
          <div>
            <h3 className="font-semibold text-gray-900 mb-2">Premium</h3>
            <p className="text-gray-600">Enterprise-grade solution with priority support and custom integrations.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
