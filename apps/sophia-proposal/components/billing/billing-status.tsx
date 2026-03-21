'use client';

import { useEffect, useState } from 'react';

interface Subscription {
  tierName: string;
  status: string;
  mcuMonthly: number;
  currentPeriodEnd: string | null;
}

interface Balance {
  balance: number;
  lifetimeCredits: number;
  lifetimeUsed: number;
}

export function BillingStatus() {
  const [loading, setLoading] = useState(true);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [balance, setBalance] = useState<Balance | null>(null);

  useEffect(() => {
    fetch('/api/billing/subscription')
      .then(res => res.json())
      .then(data => {
        setSubscription(data.subscription);
        setBalance(data.balance);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  if (loading) {
    return <div className="text-center py-8">Loading billing status...</div>;
  }

  if (!subscription) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-600 mb-4">No active subscription</p>
        <a
          href="/billing/upgrade"
          className="inline-block py-2 px-4 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          Choose a Plan
        </a>
      </div>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-3">
      <div className="border rounded p-4">
        <h4 className="text-sm text-gray-500">Current Plan</h4>
        <p className="text-xl font-semibold capitalize">{subscription.tierName}</p>
        <p className="text-sm text-gray-600">{subscription.mcuMonthly.toLocaleString()} MCU/month</p>
      </div>
      <div className="border rounded p-4">
        <h4 className="text-sm text-gray-500">MCU Balance</h4>
        <p className="text-xl font-semibold">{balance?.balance.toLocaleString() || 0}</p>
        <p className="text-sm text-gray-600">
          Used: {balance?.lifetimeUsed.toLocaleString() || 0} /
          Credits: {balance?.lifetimeCredits.toLocaleString() || 0}
        </p>
      </div>
      <div className="border rounded p-4">
        <h4 className="text-sm text-gray-500">Status</h4>
        <p className="text-xl font-semibold capitalize">{subscription.status}</p>
        {subscription.currentPeriodEnd && (
          <p className="text-sm text-gray-600">
            Renews: {new Date(subscription.currentPeriodEnd).toLocaleDateString()}
          </p>
        )}
      </div>
    </div>
  );
}
