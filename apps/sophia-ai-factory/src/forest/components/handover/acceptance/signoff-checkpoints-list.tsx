// i18n-namespace: handover
import React from 'react';
import { Check } from 'lucide-react';
import { cn } from '@/seed/utils/cn';
import { CANONICAL_ACCEPTANCE_STATEMENTS } from '@/tree/handover/handover-certificate-engine';

export function SignoffCheckpointsList({
  confirmedStatements,
  onCheckboxToggle,
}: {
  confirmedStatements: Record<number, boolean>;
  onCheckboxToggle: (idx: number) => void;
}) {
  return (
    <div className="space-y-3">
      <span className="text-xs font-bold uppercase tracking-wider text-foreground block">
        Acceptance Checkpoints (All 4 Required)
      </span>

      {CANONICAL_ACCEPTANCE_STATEMENTS.map((statement, idx) => {
        const checked = !!confirmedStatements[idx];
        return (
          <button
            key={idx}
            type="button"
            role="checkbox"
            aria-checked={checked}
            onClick={() => onCheckboxToggle(idx)}
            className={cn(
              'w-full text-left p-3 rounded-lg border transition-all flex items-start gap-3',
              checked
                ? 'bg-emerald-500/5 border-emerald-500/30'
                : 'bg-background hover:bg-muted/40 border-border/60',
            )}
          >
            <div
              className={cn(
                'w-5 h-5 rounded mt-0.5 flex items-center justify-center border transition-all shrink-0',
                checked
                  ? 'bg-emerald-500 border-emerald-500 text-white'
                  : 'border-muted-foreground/40 bg-background',
              )}
            >
              {checked && <Check className="w-3.5 h-3.5" />}
            </div>
            <span className="text-xs sm:text-sm font-medium text-foreground leading-relaxed">
              {statement}
            </span>
          </button>
        );
      })}
    </div>
  );
}
