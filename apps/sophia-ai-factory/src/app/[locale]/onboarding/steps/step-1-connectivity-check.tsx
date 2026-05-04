'use client';
/**
 * Onboarding Step 1 — Connectivity check: pings /api/health, marks milestone.
 * @module app/[locale]/onboarding/steps/step-1-connectivity-check
 */

import { useState, useEffect } from 'react';

interface Props {
  locale: string;
  onComplete: () => void;
}

type CheckState = 'idle' | 'checking' | 'ok' | 'error';

export function StepConnectivityCheck({ locale, onComplete }: Props) {
  const isVi = locale.startsWith('vi');
  const [state, setState] = useState<CheckState>('idle');
  const [latency, setLatency] = useState<number | null>(null);

  async function runCheck() {
    setState('checking');
    const start = Date.now();
    try {
      const res = await fetch('/api/health', { cache: 'no-store' });
      const ms = Date.now() - start;
      if (!res.ok) { setState('error'); return; }
      setLatency(ms);
      setState('ok');

      // Record milestone
      await fetch('/api/welcome/milestone', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ step: 'connectivity' }),
      }).catch(() => {/* non-fatal */});

      // Auto-advance after 1.5s
      setTimeout(onComplete, 1500);
    } catch {
      setState('error');
    }
  }

  useEffect(() => { runCheck(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div>
      <h2 className="text-lg font-semibold text-white mb-2">
        {isVi ? 'Kiểm tra kết nối' : 'Connectivity check'}
      </h2>
      <p className="text-zinc-400 text-sm mb-6">
        {isVi ? 'Đảm bảo kết nối đến Sophia AI hoạt động tốt.' : 'Verifying connection to Sophia AI servers.'}
      </p>

      <div className="flex items-center gap-3 p-4 bg-zinc-800 rounded-lg">
        {state === 'checking' && <SpinnerIcon />}
        {state === 'ok' && <span className="text-emerald-400 text-xl">✓</span>}
        {state === 'error' && <span className="text-red-400 text-xl">✗</span>}
        <div>
          <p className="text-sm text-white font-medium">
            {state === 'checking' && (isVi ? 'Đang kiểm tra...' : 'Checking...')}
            {state === 'ok' && (isVi ? `Kết nối tốt (${latency}ms)` : `Connected (${latency}ms)`)}
            {state === 'error' && (isVi ? 'Không thể kết nối' : 'Connection failed')}
            {state === 'idle' && (isVi ? 'Sẵn sàng' : 'Ready')}
          </p>
        </div>
      </div>

      {state === 'error' && (
        <button
          onClick={runCheck}
          className="mt-4 bg-violet-600 hover:bg-violet-700 text-white text-sm font-medium py-2 px-4 rounded-lg"
        >
          {isVi ? 'Thử lại' : 'Retry'}
        </button>
      )}
    </div>
  );
}

function SpinnerIcon() {
  return (
    <div className="w-5 h-5 border-2 border-violet-400 border-t-transparent rounded-full motion-safe:animate-spin" />
  );
}
