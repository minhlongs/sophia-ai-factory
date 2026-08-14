'use client';

/**
 * HandoverClient — user-facing handover status page.
 * Fetches from /api/handover/me (user's own record).
 */

import { useState, useEffect } from 'react';
import {
  RefreshCw,
  CheckCircle2,
  Clock,
  Loader2,
  AlertTriangle,
  Building2,
  User,
  Shield,
  Zap,
} from 'lucide-react';

interface HandoverData {
  handoverId: string;
  agencyName: string;
  tier: string;
  firstLoginAt: string | null;
  firstSopInstallAt: string | null;
  firstRunAt: string | null;
  status: string;
}

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

  function statusBadge(status: string): React.JSX.Element {
    const map: Record<
      string,
      { color: string; icon: React.ComponentType<{ className?: string }>; label: string }
    > = {
      onboarded: {
        color: 'emerald',
        icon: CheckCircle2,
        label: 'Onboarded',
      },
      in_progress: {
        color: 'amber',
        icon: Clock,
        label: 'In Progress',
      },
      pending: {
        color: 'muted',
        icon: Clock,
        label: 'Pending',
      },
      completed: {
        color: 'emerald',
        icon: CheckCircle2,
        label: 'Completed',
      },
    };
    const s = map[status] ?? {
      color: 'muted',
      icon: AlertTriangle,
      label: status,
    };
    const Icon = s.icon;
    return (
      <span
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${
          s.color === 'emerald'
            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
            : s.color === 'amber'
              ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
              : 'bg-muted text-muted-foreground border-border'
        }`}
      >
        <Icon className="w-3 h-3" />
        {s.label}
      </span>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Handover</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Your onboarding and handover progress with Sophia AI
        </p>
      </div>

      {/* Loading state */}
      {loading && (
        <div className="rounded-xl border border-border bg-card p-12 text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto text-muted-foreground" />
          <p className="text-sm text-muted-foreground mt-3">Loading handover info...</p>
        </div>
      )}

      {/* Error state */}
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

      {/* No handover */}
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

      {/* Handover details */}
      {!loading && !error && handover && (
        <div className="space-y-4">
          {/* Agency card */}
          <div className="rounded-xl border border-border bg-card p-5">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary-500/10 border border-primary-500/20">
                  <Building2 className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h2 className="font-semibold">{handover.agencyName || 'Unnamed Agency'}</h2>
                  <p className="text-xs text-muted-foreground font-mono mt-0.5">
                    ID: {handover.handoverId.slice(0, 8)}...
                  </p>
                </div>
              </div>
              {statusBadge(handover.status)}
            </div>

            {/* Tier badge */}
            <div className="mt-4 flex items-center gap-2">
              <Shield className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Tier:</span>
              <span
                className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                  handover.tier === 'MASTER'
                    ? 'bg-primary/10 text-primary border border-primary/20'
                    : handover.tier === 'ENTERPRISE'
                      ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                      : 'bg-muted text-muted-foreground'
                }`}
              >
                {handover.tier}
              </span>
            </div>
          </div>

          {/* Milestones */}
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <div className="px-5 py-3 border-b border-border">
              <h3 className="text-sm font-medium">Onboarding Milestones</h3>
            </div>
            <div className="divide-y divide-border">
              <MilestoneRow
                icon={User}
                label="First login"
                value={fmtDate(handover.firstLoginAt)}
                done={!!handover.firstLoginAt}
              />
              <MilestoneRow
                icon={Zap}
                label="First SOP installed"
                value={fmtDate(handover.firstSopInstallAt)}
                done={!!handover.firstSopInstallAt}
              />
              <MilestoneRow
                icon={CheckCircle2}
                label="First SOP run"
                value={fmtDate(handover.firstRunAt)}
                done={!!handover.firstRunAt}
              />
            </div>
          </div>

          {/* All milestones done CTA */}
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

function MilestoneRow({
  icon: Icon,
  label,
  value,
  done,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  done: boolean;
}): React.JSX.Element {
  return (
    <div className="flex items-center justify-between px-5 py-3">
      <div className="flex items-center gap-3">
        <Icon
          className={`w-4 h-4 ${
            done ? 'text-emerald-400' : 'text-muted-foreground'
          }`}
        />
        <span className="text-sm">{label}</span>
      </div>
      <div className="flex items-center gap-2">
        <span
          className={`text-xs font-mono ${
            done ? 'text-foreground' : 'text-muted-foreground'
          }`}
        >
          {value}
        </span>
        {done && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />}
      </div>
    </div>
  );
}
