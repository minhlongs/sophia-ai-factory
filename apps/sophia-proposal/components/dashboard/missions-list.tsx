'use client';

/**
 * Missions List Client Component
 * Filterable mission list with status badges and expandable detail rows.
 */

import { useEffect, useState } from 'react';

interface Mission {
  id: string;
  command: string;
  params: Record<string, unknown> | null;
  status: 'queued' | 'executing' | 'completed' | 'failed';
  result: string | null;
  created_at: string;
  updated_at: string;
}

type StatusFilter = 'all' | Mission['status'];

const STATUS_COLORS: Record<Mission['status'], string> = {
  queued: 'bg-yellow-100 text-yellow-700',
  executing: 'bg-blue-100 text-blue-700',
  completed: 'bg-green-100 text-green-700',
  failed: 'bg-red-100 text-red-700',
};

const FILTERS: { value: StatusFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'queued', label: 'Queued' },
  { value: 'executing', label: 'Executing' },
  { value: 'completed', label: 'Completed' },
  { value: 'failed', label: 'Failed' },
];

function fmt(dateStr: string) {
  return new Date(dateStr).toLocaleString('en-US', {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

function resultSummary(result: string | null): string {
  if (!result) return '—';
  try {
    const parsed = JSON.parse(result);
    if (typeof parsed === 'object' && parsed !== null) {
      const keys = Object.keys(parsed).slice(0, 3);
      return keys.map(k => `${k}: ${String(parsed[k]).substring(0, 40)}`).join(', ');
    }
    return String(parsed).substring(0, 120);
  } catch {
    return result.substring(0, 120);
  }
}

export function MissionsList() {
  const [missions, setMissions] = useState<Mission[]>([]);
  const [filter, setFilter] = useState<StatusFilter>('all');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/missions?limit=100')
      .then(r => r.json())
      .then(data => setMissions(data.missions ?? []))
      .catch(() => setError('Failed to load missions'))
      .finally(() => setLoading(false));
  }, []);

  const visible = filter === 'all'
    ? missions
    : missions.filter(m => m.status === filter);

  return (
    <div className="space-y-4">
      {/* Status filter */}
      <div className="flex items-center gap-2 flex-wrap">
        {FILTERS.map(f => (
          <button
            key={f.value}
            onClick={() => setFilter(f.value)}
            className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
              filter === f.value
                ? 'bg-primary text-white'
                : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50'
            }`}
          >
            {f.label}
          </button>
        ))}
        <span className="ml-auto text-sm text-gray-400">{visible.length} missions</span>
      </div>

      {/* List */}
      {loading ? (
        <div className="text-center py-10 text-gray-400">Loading…</div>
      ) : error ? (
        <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : visible.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-10 text-center text-gray-400">
          No missions found.
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
          {visible.map(mission => (
            <div key={mission.id}>
              {/* Row */}
              <button
                className="w-full flex items-center gap-4 px-5 py-4 text-left hover:bg-gray-50 transition-colors"
                onClick={() => setExpanded(expanded === mission.id ? null : mission.id)}
              >
                <span className={`inline-flex shrink-0 px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[mission.status]}`}>
                  {mission.status}
                </span>
                <span className="flex-1 text-sm font-medium text-gray-900 truncate">
                  {mission.command}
                </span>
                <span className="text-xs text-gray-400 shrink-0">{fmt(mission.created_at)}</span>
                <span
                  aria-label={expanded === mission.id ? 'Collapse details' : 'Expand details'}
                  className="material-symbols-outlined text-gray-400 text-base shrink-0"
                >
                  {expanded === mission.id ? 'expand_less' : 'expand_more'}
                </span>
              </button>

              {/* Expanded detail */}
              {expanded === mission.id && (
                <div className="px-5 pb-5 bg-gray-50 space-y-3 text-sm">
                  <div>
                    <span className="font-medium text-gray-700">Mission ID:</span>{' '}
                    <code className="font-mono text-xs text-gray-600">{mission.id}</code>
                  </div>
                  {mission.params && (
                    <div>
                      <span className="font-medium text-gray-700">Params:</span>
                      <pre className="mt-1 bg-white rounded border border-gray-200 px-3 py-2 text-xs text-gray-600 overflow-auto max-h-32">
                        {JSON.stringify(mission.params, null, 2)}
                      </pre>
                    </div>
                  )}
                  <div>
                    <span className="font-medium text-gray-700">Result:</span>{' '}
                    <span className="text-gray-600">{resultSummary(mission.result)}</span>
                  </div>
                  <div className="text-xs text-gray-400">
                    Updated: {fmt(mission.updated_at)}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
