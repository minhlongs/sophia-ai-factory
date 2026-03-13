'use client';

import { useState } from 'react';

interface RunResult {
  success: boolean;
  status: string;
  sop_name: string;
  steps_completed: number;
  steps_failed: number;
  duration_ms?: number;
}

export function SOPRunner() {
  const [sopName, setSopName] = useState('');
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<RunResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleRun = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sopName.trim()) return;

    setRunning(true);
    setError(null);

    try {
      const res = await fetch('/api/agi-sops/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: sopName }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to run SOP');
      }

      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="space-y-4">
      <form onSubmit={handleRun} className="flex gap-2">
        <input
          type="text"
          value={sopName}
          onChange={(e) => setSopName(e.target.value)}
          placeholder="SOP name (e.g., hello-test)"
          className="flex-1 rounded-md border border-gray-300 px-4 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
        <button
          type="submit"
          disabled={running || !sopName.trim()}
          className="rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:bg-gray-400"
        >
          {running ? 'Running...' : 'Run SOP'}
        </button>
      </form>

      {result && (
        <div className={`rounded-md p-4 ${result.success ? 'bg-green-50' : 'bg-red-50'}`}>
          <div className="flex items-center gap-2">
            <span className={`text-lg ${result.success ? 'text-green-600' : 'text-red-600'}`}>
              {result.success ? '✓' : '✗'}
            </span>
            <div>
              <h4 className={`font-medium ${result.success ? 'text-green-900' : 'text-red-900'}`}>
                {result.success ? 'Success' : 'Failed'}
              </h4>
              <p className={`text-sm ${result.success ? 'text-green-700' : 'text-red-700'}`}>
                SOP: {result.sop_name} | Steps: {result.steps_completed} completed
                {result.steps_failed > 0 && `, ${result.steps_failed} failed`}
                {result.duration_ms && ` | ${result.duration_ms}ms`}
              </p>
            </div>
          </div>
        </div>
      )}

      {error && (
        <div className="rounded-md bg-red-50 p-4">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}
    </div>
  );
}
