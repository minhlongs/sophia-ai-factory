---
title: "Phase 6 — Billing Dashboard UI"
priority: P2
status: completed
effort: 2h
completed_at: 2026-03-20
---

# PHASE 6 — BILLING DASHBOARD UI

## Overview

Create billing dashboard pages and components for subscription management, usage tracking, and plan upgrades.

## Files to Create

### Components

#### components/billing/plan-card.tsx

```tsx
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
      <h3 className="text-xl font-semibold mb-2">{tier.name}</h3>
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
        className="w-full py-2 px-4 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
      >
        {loading ? 'Processing...' : 'Upgrade'}
      </button>
    </div>
  );
}
```

#### components/billing/billing-status.tsx

```tsx
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
    return <div>Loading billing status...</div>;
  }

  if (!subscription) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-600 mb-4">No active subscription</p>
        <a
          href="/billing/upgrade"
          className="inline-block py-2 px-4 bg-blue-600 text-white rounded"
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
```

#### components/billing/usage-chart.tsx

```tsx
'use client';

import { useEffect, useState } from 'react';

interface DailyUsage {
  date: string;
  mcuUsed: number;
}

export function UsageChart() {
  const [loading, setLoading] = useState(true);
  const [usage, setUsage] = useState<DailyUsage[]>([]);

  useEffect(() => {
    fetch('/api/usage?days=30')
      .then(res => res.json())
      .then(data => {
        setUsage(data.dailyUsage || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  if (loading) {
    return <div>Loading usage data...</div>;
  }

  if (usage.length === 0) {
    return <p className="text-gray-500">No usage data available</p>;
  }

  const maxUsage = Math.max(...usage.map(d => d.mcuUsed), 1);

  return (
    <div className="h-48 flex items-end gap-1">
      {usage.map(day => (
        <div
          key={day.date}
          className="flex-1 bg-blue-500 hover:bg-blue-600 transition-colors rounded-t"
          style={{ height: `${(day.mcuUsed / maxUsage) * 100}%` }}
          title={`${day.date}: ${day.mcuUsed} MCU`}
        />
      ))}
    </div>
  );
}
```

### Pages

#### app/(dashboard)/billing/page.tsx

```tsx
'use client';

import { BillingStatus } from '@/components/billing/billing-status';
import { UsageChart } from '@/components/billing/usage-chart';
import { useState } from 'react';

export default function BillingPage() {
  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Billing & Subscription</h1>
        <p className="text-gray-600">Manage your subscription and view usage</p>
      </div>

      <BillingStatus />

      <div className="grid gap-6 md:grid-cols-2">
        <div className="border rounded-lg p-6">
          <h2 className="text-lg font-semibold mb-4">Usage Overview (30 days)</h2>
          <UsageChart />
        </div>

        <div className="border rounded-lg p-6">
          <h2 className="text-lg font-semibold mb-4">Manage Subscription</h2>
          <div className="space-y-4">
            <a
              href="/api/billing/portal"
              className="block py-2 px-4 bg-gray-100 text-gray-700 rounded hover:bg-gray-200 text-center"
            >
              Open Customer Portal
            </a>
            <a
              href="/billing/upgrade"
              className="block py-2 px-4 bg-blue-600 text-white rounded hover:bg-blue-700 text-center"
            >
              Upgrade Plan
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
```

#### app/(dashboard)/billing/upgrade/page.tsx

```tsx
'use client';

import { PlanCard } from '@/components/billing/plan-card';
import { POLAR_TIERS } from '@/lib/billing/polar-client';

export default function UpgradePage() {
  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Choose Your Plan</h1>
        <p className="text-gray-600">Select the plan that fits your needs</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        {Object.keys(POLAR_TIERS).map(tier => (
          <PlanCard
            key={tier}
            tierName={tier as keyof typeof POLAR_TIERS}
            onSelect={() => {}}
          />
        ))}
      </div>
    </div>
  );
}
```

#### app/(dashboard)/usage/page.tsx

```tsx
'use client';

import { useEffect, useState } from 'react';

interface UsageLog {
  id: string;
  feature: string;
  mcu_cost: number;
  created_at: string;
}

export default function UsagePage() {
  const [loading, setLoading] = useState(true);
  const [logs, setLogs] = useState<UsageLog[]>([]);
  const [page, setPage] = useState(1);

  useEffect(() => {
    fetch(`/api/usage?page=${page}&limit=50`)
      .then(res => res.json())
      .then(data => {
        setLogs(data.logs || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [page]);

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Usage History</h1>
        <p className="text-gray-600">View your MCU consumption</p>
      </div>

      {loading ? (
        <p>Loading...</p>
      ) : logs.length === 0 ? (
        <p className="text-gray-500">No usage recorded yet</p>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left text-sm font-medium text-gray-500">Date</th>
                <th className="px-4 py-2 text-left text-sm font-medium text-gray-500">Feature</th>
                <th className="px-4 py-2 text-right text-sm font-medium text-gray-500">MCU</th>
              </tr>
            </thead>
            <tbody>
              {logs.map(log => (
                <tr key={log.id} className="border-t">
                  <td className="px-4 py-2 text-sm">
                    {new Date(log.created_at).toLocaleString()}
                  </td>
                  <td className="px-4 py-2 text-sm">{log.feature}</td>
                  <td className="px-4 py-2 text-sm text-right">{log.mcu_cost}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="flex justify-between">
        <button
          onClick={() => setPage(p => Math.max(1, p - 1))}
          disabled={page === 1}
          className="px-4 py-2 border rounded disabled:opacity-50"
        >
          Previous
        </button>
        <span className="py-2">Page {page}</span>
        <button
          onClick={() => setPage(p => p + 1)}
          className="px-4 py-2 border rounded"
        >
          Next
        </button>
      </div>
    </div>
  );
}
```

### API Routes

#### app/api/usage/route.ts

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { createServerClient } from '@/lib/supabase/client';
import { getUsageHistory, getUsageSummary } from '@/lib/billing/usage-tracker';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = createServerClient();
    const { data: orgMember } = await supabase
      .from('organization_members')
      .select('org_id')
      .eq('user_id', session.user.id)
      .single();

    if (!orgMember) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
    }

    const searchParams = request.nextUrl.searchParams;
    const days = parseInt(searchParams.get('days') || '30');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');

    const [summary, logs] = await Promise.all([
      getUsageSummary(orgMember.org_id, days),
      getUsageHistory(orgMember.org_id, limit, (page - 1) * limit),
    ]);

    return NextResponse.json({
      summary,
      logs,
      pagination: { page, limit },
    });
  } catch (error) {
    console.error('Usage fetch error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
```

## Success Criteria

- [x] Billing dashboard shows subscription status
- [x] Usage chart displays 30-day history
- [x] Plan cards with working upgrade buttons
- [x] Usage history table with pagination
- [x] Customer portal link working

**Completed:** 2026-03-20

## Related Files

- Components: `components/billing/`
- Pages: `app/(dashboard)/billing/`, `app/(dashboard)/usage/`
- Usage API: `app/api/usage/route.ts`
