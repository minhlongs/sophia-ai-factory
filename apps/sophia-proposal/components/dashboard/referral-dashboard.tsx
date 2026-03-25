'use client';

/**
 * Referral Dashboard — shows referral codes, stats, and earnings.
 * Fetches from /api/referrals/codes and /api/referrals/stats.
 * Handles missing API gracefully with empty state.
 */

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';

interface ReferralCode {
  id: string;
  code: string;
  max_uses: number;
  current_uses: number;
  reward_amount: number;
  is_active: boolean;
  created_at: string;
}

interface ReferralStats {
  totalSignups: number;
  totalConversions: number;
  totalEarnings: number;
  conversionRate: number;
}

function StatCard({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string | number;
  highlight?: boolean;
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <p className="text-sm text-gray-500">{label}</p>
      <p className={`mt-1 text-3xl font-bold ${highlight ? 'text-indigo-600' : 'text-gray-900'}`}>
        {value}
      </p>
    </div>
  );
}

export function ReferralDashboard() {
  const [codes, setCodes] = useState<ReferralCode[]>([]);
  const [stats, setStats] = useState<ReferralStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch('/api/referrals/codes').then((r) => r.json()),
      fetch('/api/referrals/stats').then((r) => r.json()),
    ])
      .then(([codesData, statsData]) => {
        setCodes(codesData.codes ?? []);
        setStats(statsData.stats ?? null);
      })
      .catch(() => {
        // API not ready — show empty state
      })
      .finally(() => setLoading(false));
  }, []);

  const copyCode = (code: string) => {
    const url = `https://sophia.agencyos.network/signup?ref=${code}`;
    navigator.clipboard.writeText(url);
    setCopied(code);
    setTimeout(() => setCopied(null), 2000);
  };

  const handleCreateCode = async () => {
    setCreating(true);
    try {
      const res = await fetch('/api/referrals/codes', { method: 'POST' });
      const data = await res.json();
      if (data.code) setCodes((prev) => [data.code, ...prev]);
    } catch {
      // ignore
    }
    setCreating(false);
  };

  if (loading) {
    return <div className="text-center py-10 text-gray-400">Loading referral data...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Stats cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <StatCard label="Referral Signups" value={stats?.totalSignups ?? 0} />
        <StatCard label="Conversions" value={stats?.totalConversions ?? 0} />
        <StatCard
          label="Conversion Rate"
          value={`${(stats?.conversionRate ?? 0).toFixed(1)}%`}
        />
        <StatCard
          label="Total Earnings"
          value={`$${(stats?.totalEarnings ?? 0).toLocaleString()}`}
          highlight
        />
      </div>

      {/* Revenue share info */}
      <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-5">
        <h3 className="font-semibold text-indigo-900 mb-1">20% Revenue Share for 12 Months</h3>
        <p className="text-sm text-indigo-700">
          Earn 20% of every subscription payment from your referrals for their first 12 months.
          Share your unique link and start earning.
        </p>
      </div>

      {/* Referral codes */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h3 className="font-semibold text-gray-900">Your Referral Codes</h3>
          <Button variant="primary" size="sm" onClick={handleCreateCode} disabled={creating}>
            {creating ? 'Creating...' : '+ New Code'}
          </Button>
        </div>

        {codes.length === 0 ? (
          <div className="p-10 text-center text-gray-400">
            No referral codes yet. Create one to start earning.
          </div>
        ) : (
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-5 py-3 text-left font-medium text-gray-500">Code</th>
                <th className="px-5 py-3 text-right font-medium text-gray-500">Uses</th>
                <th className="px-5 py-3 text-right font-medium text-gray-500">Commission</th>
                <th className="px-5 py-3 text-right font-medium text-gray-500">Status</th>
                <th className="px-5 py-3 text-right font-medium text-gray-500">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {codes.map((code) => (
                <tr key={code.id} className="hover:bg-gray-50">
                  <td className="px-5 py-3 font-mono text-gray-900">{code.code}</td>
                  <td className="px-5 py-3 text-right text-gray-600">
                    {code.current_uses} / {code.max_uses}
                  </td>
                  <td className="px-5 py-3 text-right text-gray-600">{code.reward_amount}%</td>
                  <td className="px-5 py-3 text-right">
                    <span
                      className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                        code.is_active
                          ? 'bg-green-100 text-green-700'
                          : 'bg-gray-100 text-gray-500'
                      }`}
                    >
                      {code.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-right">
                    <button
                      onClick={() => copyCode(code.code)}
                      className="text-indigo-600 hover:text-indigo-800 text-sm font-medium"
                    >
                      {copied === code.code ? 'Copied!' : 'Copy Link'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
