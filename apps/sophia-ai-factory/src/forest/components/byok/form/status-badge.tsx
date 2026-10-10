import { Check, WifiOff } from 'lucide-react';

export type StatusBadgeType = 'not_configured' | 'connected' | 'error' | 'testing';

interface StatusBadgeProps {
  status: StatusBadgeType;
}

export function StatusBadge({ status }: StatusBadgeProps) {
  if (status === 'testing') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-semibold rounded-full border bg-blue-500/10 text-blue-400 border-blue-500/20 animate-pulse">
        <span className="w-1 h-1 rounded-full bg-blue-400 animate-ping" />
        Testing
      </span>
    );
  }
  if (status === 'connected') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-semibold rounded-full border bg-emerald-500/10 text-emerald-400 border-emerald-500/20">
        <Check className="h-3 w-3 text-emerald-400" />
        Active
      </span>
    );
  }
  if (status === 'error') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-semibold rounded-full border bg-rose-500/10 text-rose-400 border-rose-500/20">
        <WifiOff className="h-3 w-3 text-rose-400" />
        Failed
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-semibold rounded-full border bg-muted/50 text-muted-foreground border-border">
      Inactive
    </span>
  );
}
