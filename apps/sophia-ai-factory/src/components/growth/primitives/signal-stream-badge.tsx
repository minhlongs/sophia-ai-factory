'use client';

/**
 * Presentation Layer Primitive: Signal Stream Badge
 * Visual status indicator badge with pulse animation for Obsidian Cyber-Glass telemetry.
 * Layer: presentation/components/growth/primitives | Max LOC: < 200 | Zero :any
 * @module components/growth/primitives/signal-stream-badge
 */

import React from 'react';

export interface SignalStreamBadgeProps {
  label: string;
  status?: 'active' | 'pending' | 'halted' | 'warning' | 'idle';
  pulse?: boolean;
}

const STATUS_STYLES = {
  active: {
    border: 'border-emerald-500/30',
    bg: 'bg-emerald-950/30',
    dot: 'bg-emerald-400',
    text: 'text-emerald-300',
  },
  pending: {
    border: 'border-amber-500/30',
    bg: 'bg-amber-950/30',
    dot: 'bg-amber-400',
    text: 'text-amber-300',
  },
  halted: {
    border: 'border-rose-500/30',
    bg: 'bg-rose-950/30',
    dot: 'bg-rose-400',
    text: 'text-rose-300',
  },
  warning: {
    border: 'border-orange-500/30',
    bg: 'bg-orange-950/30',
    dot: 'bg-orange-400',
    text: 'text-orange-300',
  },
  idle: {
    border: 'border-neutral-700',
    bg: 'bg-neutral-800/40',
    dot: 'bg-neutral-500',
    text: 'text-neutral-400',
  },
};

export function SignalStreamBadge({
  label,
  status = 'active',
  pulse = true,
}: SignalStreamBadgeProps) {
  const styles = STATUS_STYLES[status];

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${styles.border} ${styles.bg} ${styles.text}`}
    >
      <span
        className={`h-1.5 w-1.5 rounded-full ${styles.dot} ${pulse ? 'animate-pulse' : ''}`}
      />
      {label}
    </span>
  );
}
