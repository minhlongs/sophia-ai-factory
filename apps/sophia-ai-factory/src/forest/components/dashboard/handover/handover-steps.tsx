'use client';

import React from 'react';
import { CheckCircle2, User, Zap } from 'lucide-react';
import type { MilestoneRowProps, MilestonesCardProps } from './types';

export function MilestoneRow({
  icon: Icon,
  label,
  value,
  done,
}: MilestoneRowProps): React.JSX.Element {
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

export function MilestonesCard({
  handover,
  fmtDate,
}: MilestonesCardProps): React.JSX.Element {
  return (
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
  );
}
