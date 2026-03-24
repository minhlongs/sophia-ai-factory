'use client';

import { useState } from 'react';
import { POLAR_TIERS } from '@/lib/billing/polar-client';

interface UpgradeButtonProps {
  tierName: keyof typeof POLAR_TIERS;
  variant?: 'primary' | 'outline';
  className?: string;
}

export function UpgradeButton({ tierName, variant = 'primary', className = '' }: UpgradeButtonProps) {
  const [loading, setLoading] = useState(false);
  const tier = POLAR_TIERS[tierName];

  const handleUpgrade = async () => {
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
      } else {
        console.error('Checkout failed');
      }
    } catch (error) {
      console.error('Checkout error:', error);
    } finally {
      setLoading(false);
    }
  };

  const baseClasses = 'py-2 px-4 rounded font-medium transition-colors';
  const variantClasses = variant === 'primary'
    ? 'bg-primary text-white hover:bg-primary-hover'
    : 'border border-primary text-primary hover:bg-primary/10';

  return (
    <button
      onClick={handleUpgrade}
      disabled={loading}
      className={`${baseClasses} ${variantClasses} ${className} disabled:opacity-50 disabled:cursor-not-allowed`}
    >
      {loading ? 'Processing...' : `Upgrade to ${tier.name} - $${tier.price / 100}`}
    </button>
  );
}
