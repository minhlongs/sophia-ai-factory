/**
 * Queue Stat Pill Component
 *
 * Layer: forest/components/dashboard/payouts
 */

import React from 'react';

interface StatPillProps {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  color: 'violet' | 'emerald' | 'amber';
}

export function StatPill({ icon: Icon, label, value, color }: StatPillProps): React.JSX.Element {
  const colors: Record<string, string> = {
    violet: 'text-primary-400 bg-primary-500/10 border-primary-500/20',
    emerald: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
    amber: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
  };
  return (
    <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs ${colors[color]}`}>
      <Icon className="w-3.5 h-3.5" />
      <span className="text-muted-foreground">{label}</span>
      <span className="font-mono font-medium">{value}</span>
    </div>
  );
}
