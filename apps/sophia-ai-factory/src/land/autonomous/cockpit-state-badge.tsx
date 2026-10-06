'use client';

/**
 * Autonomous Operations Cockpit - FSM State Badge
 *
 * @module land/autonomous/cockpit-state-badge
 */

import React from 'react';
import { Pause, RefreshCw, ShieldAlert, ShieldCheck } from 'lucide-react';

interface CockpitStateBadgeProps {
  state: string;
  label: string;
}

export function CockpitStateBadge({ state, label }: CockpitStateBadgeProps) {
  switch (state) {
    case 'RUNNING':
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          {label}
        </span>
      );
    case 'PAUSED':
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
          <Pause className="w-3 h-3" />
          {label}
        </span>
      );
    case 'RECOVERING':
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
          <RefreshCw className="w-3 h-3 animate-spin" />
          {label}
        </span>
      );
    case 'CIRCUIT_BROKEN':
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
          <ShieldAlert className="w-3 h-3" />
          {label}
        </span>
      );
    case 'IDLE':
    default:
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
          <ShieldCheck className="w-3 h-3" />
          {label}
        </span>
      );
  }
}
