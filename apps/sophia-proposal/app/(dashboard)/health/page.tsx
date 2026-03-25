/**
 * /dashboard/health — System health dashboard.
 * Displays D1 connectivity, template status, version, uptime.
 * Auto-refreshes every 30 seconds.
 */

'use client';

import { useEffect, useState, useCallback } from 'react';

interface HealthCheck {
  status: string;
  latency_ms?: number;
  error?: string;
}

interface HealthData {
  status: string;
  version: string;
  uptime_seconds: number;
  checks: Record<string, HealthCheck>;
  timestamp: string;
  region: string;
}

const STATUS_COLOR: Record<string, string> = {
  healthy: 'bg-green-100 text-green-800',
  degraded: 'bg-yellow-100 text-yellow-800',
  unhealthy: 'bg-red-100 text-red-800',
};

function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${STATUS_COLOR[status] ?? 'bg-gray-100 text-gray-800'}`}>
      {status}
    </span>
  );
}

function formatUptime(seconds: number): string {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (d > 0) return `${d}d ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

export default function HealthDashboardPage() {
  const [health, setHealth] = useState<HealthData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastFetch, setLastFetch] = useState<Date | null>(null);

  const fetchHealth = useCallback(async () => {
    try {
      const res = await fetch('/api/health', { cache: 'no-store' });
      const data: HealthData = await res.json();
      setHealth(data);
      setError(null);
      setLastFetch(new Date());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch health status');
    }
  }, []);

  useEffect(() => {
    fetchHealth();
    const interval = setInterval(fetchHealth, 30_000);
    return () => clearInterval(interval);
  }, [fetchHealth]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">System Health</h1>
          <p className="text-sm text-gray-500">
            Auto-refreshes every 30s
            {lastFetch && <> · Last checked {lastFetch.toLocaleTimeString()}</>}
          </p>
        </div>
        <button
          onClick={fetchHealth}
          className="px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
        >
          <span className="material-symbols-outlined text-base align-middle mr-1">refresh</span>
          Refresh
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md text-sm">
          {error}
        </div>
      )}

      {health && (
        <>
          {/* Overall status card */}
          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className={`w-4 h-4 rounded-full ${health.status === 'healthy' ? 'bg-green-500' : health.status === 'degraded' ? 'bg-yellow-500' : 'bg-red-500'}`} />
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">Overall Status</h2>
                  <StatusBadge status={health.status} />
                </div>
              </div>
              <div className="text-right text-sm text-gray-500">
                <p>v{health.version}</p>
                <p>Uptime: {formatUptime(health.uptime_seconds)}</p>
                <p>Region: {health.region}</p>
              </div>
            </div>
          </div>

          {/* Individual checks */}
          <div className="bg-white border border-gray-200 rounded-lg divide-y divide-gray-200">
            <div className="px-6 py-3 bg-gray-50 rounded-t-lg">
              <h3 className="text-sm font-medium text-gray-700">Service Checks</h3>
            </div>
            {Object.entries(health.checks).map(([name, check]) => (
              <div key={name} className="px-6 py-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="material-symbols-outlined text-base text-gray-400">
                    {name === 'database' ? 'database' : 'check_circle'}
                  </span>
                  <div>
                    <p className="text-sm font-medium text-gray-900 capitalize">{name}</p>
                    {check.error && (
                      <p className="text-xs text-red-600">{check.error}</p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  {check.latency_ms !== undefined && (
                    <span className="text-xs text-gray-500">{check.latency_ms}ms</span>
                  )}
                  <StatusBadge status={check.status} />
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {!health && !error && (
        <div className="text-center text-gray-500 py-12">Loading health status...</div>
      )}
    </div>
  );
}
