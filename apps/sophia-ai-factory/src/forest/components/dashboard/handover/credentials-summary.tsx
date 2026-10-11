'use client';

import React from 'react';
import { Building2, Shield, CheckCircle2, Clock, AlertTriangle } from 'lucide-react';
import type { AgencyCardProps } from './types';

export function statusBadge(status: string): React.JSX.Element {
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

export function AgencyCard({ handover }: AgencyCardProps): React.JSX.Element {
  return (
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
  );
}
