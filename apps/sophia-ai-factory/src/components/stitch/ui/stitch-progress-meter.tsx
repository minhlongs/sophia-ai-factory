import React from 'react';

export interface StitchProgressMeterProps {
  readonly valuePct: number;
  readonly tone?: 'amber' | 'emerald' | 'indigo';
  readonly heightClass?: string;
  readonly ariaLabel?: string;
  readonly className?: string;
}

const TONE_FILL_CLASSES: Record<
  NonNullable<StitchProgressMeterProps['tone']>,
  string
> = {
  amber: 'bg-amber-400',
  emerald: 'bg-emerald-400',
  indigo: 'bg-gradient-to-r from-indigo-500 to-amber-400',
};

export function StitchProgressMeter({
  valuePct,
  tone = 'amber',
  heightClass = 'h-2',
  ariaLabel,
  className = '',
}: Readonly<StitchProgressMeterProps>) {
  const clampedPct = Math.min(100, Math.max(0, valuePct));

  return (
    <div
      role={ariaLabel ? 'progressbar' : undefined}
      aria-label={ariaLabel}
      aria-valuenow={ariaLabel ? clampedPct : undefined}
      aria-valuemin={ariaLabel ? 0 : undefined}
      aria-valuemax={ariaLabel ? 100 : undefined}
      aria-hidden={ariaLabel ? undefined : true}
      className={`w-full overflow-hidden rounded-full bg-slate-800/80 ${heightClass} ${className}`.trim()}
    >
      <div
        className={`h-full rounded-full transition-all duration-300 motion-reduce:transition-none ${TONE_FILL_CLASSES[tone]}`}
        style={{ width: `${clampedPct}%` }}
      />
    </div>
  );
}
