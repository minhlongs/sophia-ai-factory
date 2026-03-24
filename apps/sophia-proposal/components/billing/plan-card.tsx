'use client';

import { useState } from 'react';
import { POLAR_TIERS } from '@/lib/billing/polar-client';

interface PlanCardProps {
  tierName: keyof typeof POLAR_TIERS;
  onSelect: (tier: keyof typeof POLAR_TIERS) => void;
  disabled?: boolean;
}

export function PlanCard({ tierName, onSelect, disabled }: PlanCardProps) {
  const tier = POLAR_TIERS[tierName];
  const [loading, setLoading] = useState(false);

  const handleSelect = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/billing/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tier: tierName }),
      });

      if (res.ok) {
        const data = await res.json();
        window.location.href = data.url;
      }
    } catch (error) {
      console.error('Checkout error:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="border rounded-lg p-6 hover:shadow-lg transition-shadow">
      <h3 className="text-xl font-semibold mb-2 capitalize">{tier.name}</h3>
      <p className="text-3xl font-bold mb-4">
        ${tier.price / 100}
        <span className="text-sm font-normal text-gray-500">/month</span>
      </p>
      <p className="text-gray-600 mb-4">{tier.mcuMonthly.toLocaleString()} MCU/month</p>
      <ul className="space-y-2 mb-6">
        <li className="text-sm">Overage: ${tier.mcuOverageRate}/MCU</li>
      </ul>
      <button
        onClick={handleSelect}
        disabled={disabled || loading}
        className="w-full py-2 px-4 bg-primary text-white rounded hover:bg-primary-hover disabled:opacity-50"
      >
        {loading ? 'Processing...' : 'Upgrade'}
      </button>
    </div>
  );
}
