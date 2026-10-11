'use client';

import React, { useState, useEffect } from 'react';
import { RefreshCw, CheckCircle2, Loader2, AlertTriangle, Building2 } from 'lucide-react';
import type { HandoverData } from './types';
import { AgencyCard } from './credentials-summary';
import { MilestonesCard } from './handover-steps';

export function HandoverClient(): React.JSX.Element {
  const [handover, setHandover] = useState<HandoverData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchHandover = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/handover/me', { cache: 'no-store' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as Record<string, unknown>;
      setHandover(json.handover as HandoverData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load handover');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHandover();
  }, []);

  function fmtDate(ts: string | null): string {
    if (!ts) return 'Pending';
    return new Date(ts).toLocaleDateString('vi-VN', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    });
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Handover</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Your onboarding and handover progress with Sophia AI
        </p>
      </div>

      {loading && (
        <div className="rounded-xl border border-border bg-card p-12 text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto text-muted-foreground" />
          <p className="text-sm text-muted-foreground mt-3">Loading handover info...</p>
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" />
            {error}
          </div>
          <button
            onClick={fetchHandover}
            className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-border bg-card text-xs hover:bg-muted transition-colors"
          >
            <RefreshCw className="w-3 h-3" />
            Retry
          </button>
        </div>
      )}

      {!loading && !error && !handover && (
        <div className="rounded-xl border border-border bg-card p-12 text-center space-y-3">
          <Building2 className="w-10 h-10 mx-auto text-muted-foreground" />
          <h2 className="text-lg font-medium">No handover record found</h2>
          <p className="text-sm text-muted-foreground max-w-md mx-auto">
            If you&apos;ve been invited to Sophia AI, your handover record will appear here
            once the admin completes the onboarding process.
          </p>
        </div>
      )}

      {!loading && !error && handover && (
        <div className="space-y-4">
          <AgencyCard handover={handover} />
          <MilestonesCard handover={handover} fmtDate={fmtDate} />

          {handover.firstLoginAt &&
            handover.firstSopInstallAt &&
            handover.firstRunAt && (
              <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-5">
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="w-6 h-6 text-emerald-400" />
                  <div>
                    <h3 className="font-medium text-emerald-200">
                      Handover Complete!
                    </h3>
                    <p className="text-sm text-emerald-300/80 mt-0.5">
                      All milestones reached. You&apos;re fully onboarded.
                    </p>
                  </div>
                </div>
              </div>
            )}
        </div>
      )}
    </div>
  );
}
