'use client';

/**
 * ReferralDashboard
 *
 * Displays referral link, stats, share buttons, and payout history.
 * Fetches data from /api/referral/stats and /api/referral/code.
 */

import { useEffect, useState, useCallback } from 'react';

interface ReferralStats {
  clicks: number;
  signups: number;
  conversions: number;
  total_earned: number;
  pending_payout: number;
  commission_rate: number;
}

interface PayoutRecord {
  id: string;
  amount: number;
  status: string;
  payout_method: string;
  period_start: string;
  period_end: string;
  created_at: string;
}

interface StatsResponse {
  code: string | null;
  stats: ReferralStats;
  payout_history: PayoutRecord[];
}

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  processing: 'bg-blue-100 text-blue-800',
  paid: 'bg-green-100 text-green-800',
  failed: 'bg-red-100 text-red-800',
};

export function ReferralDashboard() {
  const [data, setData] = useState<StatsResponse | null>(null);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch('/api/referral/stats');
      if (res.ok) setData(await res.json());
    } catch (e) {
      console.error('Failed to load referral stats:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchStats(); }, [fetchStats]);

  const referralUrl = data?.code
    ? `${window.location.origin}/?ref=${data.code}`
    : '';

  const copyLink = async () => {
    if (!referralUrl) return;
    await navigator.clipboard.writeText(referralUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const shareLinks = {
    twitter: `https://twitter.com/intent/tweet?text=I%20use%20Sophia%20AI%20Factory%20to%20generate%20winning%20proposals%20in%20minutes.%20Try%20it%3A%20${encodeURIComponent(referralUrl)}`,
    linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(referralUrl)}`,
    email: `mailto:?subject=Check%20out%20Sophia%20AI%20Factory&body=I%20recommend%20this%20tool%3A%20${encodeURIComponent(referralUrl)}`,
  };

  if (loading) {
    return <div className="animate-pulse h-64 bg-gray-100 rounded-xl" />;
  }

  const stats = data?.stats;

  return (
    <div className="space-y-6">
      {/* Referral link */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-1">Your Referral Link</h2>
        <p className="text-sm text-gray-500 mb-4">
          Earn {((stats?.commission_rate ?? 0.2) * 100).toFixed(0)}% commission (as MCU credits)
          for each conversion — first 3 months.
        </p>
        <div className="flex gap-2">
          <input
            readOnly
            value={referralUrl || 'Loading…'}
            className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm bg-gray-50 font-mono"
          />
          <button
            onClick={copyLink}
            className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 transition-colors"
          >
            {copied ? 'Copied!' : 'Copy'}
          </button>
        </div>
        {referralUrl && (
          <div className="flex gap-3 mt-4">
            <a href={shareLinks.twitter} target="_blank" rel="noopener noreferrer"
              className="text-sm text-blue-500 hover:underline">Share on X</a>
            <a href={shareLinks.linkedin} target="_blank" rel="noopener noreferrer"
              className="text-sm text-blue-700 hover:underline">Share on LinkedIn</a>
            <a href={shareLinks.email}
              className="text-sm text-gray-600 hover:underline">Share via Email</a>
          </div>
        )}
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Clicks', value: stats?.clicks ?? 0 },
          { label: 'Signups', value: stats?.signups ?? 0 },
          { label: 'Conversions', value: stats?.conversions ?? 0 },
          { label: 'Total Earned ($)', value: `$${(stats?.total_earned ?? 0).toFixed(2)}` },
        ].map(({ label, value }) => (
          <div key={label} className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 text-center">
            <p className="text-2xl font-bold text-gray-900">{value}</p>
            <p className="text-xs text-gray-500 mt-1">{label}</p>
          </div>
        ))}
      </div>

      {/* Pending payout */}
      {(stats?.pending_payout ?? 0) > 0 && (
        <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4 flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-indigo-800">Pending Payout</p>
            <p className="text-xs text-indigo-600">Will be credited as MCU credits</p>
          </div>
          <p className="text-xl font-bold text-indigo-700">${stats!.pending_payout.toFixed(2)}</p>
        </div>
      )}

      {/* Payout history */}
      {(data?.payout_history?.length ?? 0) > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
          <h3 className="text-base font-semibold text-gray-900 mb-4">Payout History</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 border-b border-gray-100">
                  <th className="pb-2 font-medium">Period</th>
                  <th className="pb-2 font-medium">Amount</th>
                  <th className="pb-2 font-medium">Method</th>
                  <th className="pb-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {data!.payout_history.map((p) => (
                  <tr key={p.id}>
                    <td className="py-2 text-gray-600">{p.period_start} – {p.period_end}</td>
                    <td className="py-2 font-medium">${Number(p.amount).toFixed(2)}</td>
                    <td className="py-2 text-gray-500 capitalize">{p.payout_method}</td>
                    <td className="py-2">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[p.status] ?? 'bg-gray-100 text-gray-700'}`}>
                        {p.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
