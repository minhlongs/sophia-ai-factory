'use client';

/**
 * Affiliate Dashboard Component
 *
 * Shows: programs tracked, content counts, total clicks,
 * estimated revenue, and quick-generate action.
 */

import { useEffect, useState } from 'react';

interface DashboardStats {
  totalPrograms: number;
  contentCounts: { blog: number; video: number; social: number };
  totalClicks: number;
  estimatedRevenue: number;
  topProgramId: string | null;
}

const DEFAULT_STATS: DashboardStats = {
  totalPrograms: 0,
  contentCounts: { blog: 0, video: 0, social: 0 },
  totalClicks: 0,
  estimatedRevenue: 0,
  topProgramId: null,
};

export function AffiliateDashboard() {
  const [stats, setStats] = useState<DashboardStats>(DEFAULT_STATS);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void fetchStats();
  }, []);

  async function fetchStats() {
    try {
      setLoading(true);
      const [programsRes, contentRes, clicksRes] = await Promise.all([
        fetch('/api/affiliate/programs'),
        fetch('/api/affiliate/content'),
        fetch('/api/affiliate/clicks/stats'),
      ]);

      const programs = programsRes.ok ? await programsRes.json() : { data: [] };
      const content = contentRes.ok ? await contentRes.json() : { data: [] };
      const clicks = clicksRes.ok ? await clicksRes.json() : { total: 0, byProgram: {} };

      const counts = { blog: 0, video: 0, social: 0 };
      for (const item of content.data ?? []) {
        if (item.content_type in counts) counts[item.content_type as keyof typeof counts]++;
      }

      // Top program by click count
      const topProgramId = Object.entries(clicks.byProgram ?? {})
        .sort(([, a], [, b]) => (b as number) - (a as number))[0]?.[0] ?? null;

      // Rough revenue estimate: assume $0.50 avg commission value per click
      const estimatedRevenue = (clicks.total ?? 0) * 0.5;

      setStats({
        totalPrograms: programs.data?.length ?? 0,
        contentCounts: counts,
        totalClicks: clicks.total ?? 0,
        estimatedRevenue,
        topProgramId,
      });
    } catch {
      setError('Failed to load dashboard stats');
    } finally {
      setLoading(false);
    }
  }

  async function handleGenerateForTopProgram() {
    if (!stats.topProgramId) return;
    setGenerating(true);
    setError(null);
    try {
      const res = await fetch('/api/affiliate/content/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          programId: stats.topProgramId,
          contentTypes: ['blog', 'social'],
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? 'Generation failed');
      } else {
        await fetchStats();
      }
    } catch {
      setError('Failed to generate content');
    } finally {
      setGenerating(false);
    }
  }

  if (loading) {
    return <div className="p-6 text-gray-500 text-sm animate-pulse">Loading affiliate stats...</div>;
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-gray-900">Affiliate Engine</h2>
        <button
          onClick={handleGenerateForTopProgram}
          disabled={generating || !stats.topProgramId}
          className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {generating ? 'Generating...' : 'Generate for Top Program'}
        </button>
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          {error}
        </div>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Programs Tracked" value={stats.totalPrograms} />
        <StatCard label="Total Clicks" value={stats.totalClicks} />
        <StatCard
          label="Est. Revenue"
          value={`$${stats.estimatedRevenue.toFixed(2)}`}
          highlight
        />
        <StatCard
          label="Content Pieces"
          value={stats.contentCounts.blog + stats.contentCounts.video + stats.contentCounts.social}
        />
      </div>

      {/* Content Breakdown */}
      <div className="bg-gray-50 rounded-lg p-4">
        <h3 className="text-sm font-medium text-gray-700 mb-3">Content Generated</h3>
        <div className="flex gap-6 text-sm">
          <ContentBadge type="Blog" count={stats.contentCounts.blog} color="blue" />
          <ContentBadge type="Video" count={stats.contentCounts.video} color="purple" />
          <ContentBadge type="Social" count={stats.contentCounts.social} color="green" />
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, highlight = false }: {
  label: string;
  value: string | number;
  highlight?: boolean;
}) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4">
      <p className="text-xs text-gray-500 uppercase tracking-wide">{label}</p>
      <p className={`text-2xl font-bold mt-1 ${highlight ? 'text-indigo-600' : 'text-gray-900'}`}>
        {value}
      </p>
    </div>
  );
}

function ContentBadge({ type, count, color }: { type: string; count: number; color: string }) {
  const colors: Record<string, string> = {
    blue: 'bg-blue-100 text-blue-700',
    purple: 'bg-purple-100 text-purple-700',
    green: 'bg-green-100 text-green-700',
  };
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${colors[color]}`}>
      {type}
      <span className="font-bold">{count}</span>
    </span>
  );
}
