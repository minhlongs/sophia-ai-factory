import React from 'react';
import { CheckCircle2, Loader2, AlertCircle } from 'lucide-react';

export function getIndicatorClasses(
  isFailed: boolean,
  isPast: boolean,
  isCurrent: boolean
): string {
  if (isFailed) return 'border-destructive bg-destructive/10 text-destructive';
  if (isPast) return 'border-primary bg-primary text-primary-foreground';
  if (isCurrent) return 'border-primary bg-primary/20 text-primary ring-2 ring-primary/30';
  return 'border-border bg-muted/40 text-muted-foreground';
}

export function renderStageIcon(
  isFailed: boolean,
  isPast: boolean,
  isCurrent: boolean,
  status: string,
  stepNumber: number
): React.ReactNode {
  if (isFailed) return <AlertCircle className="h-3.5 w-3.5" />;
  if (isPast) return <CheckCircle2 className="h-3.5 w-3.5" />;
  if (isCurrent && status === 'running') {
    return <Loader2 className="h-3.5 w-3.5 animate-spin" />;
  }
  return stepNumber;
}
