import React from 'react';
import { ArrowUpRight, ArrowDownRight, Minus } from 'lucide-react';
import { cn } from '@/seed/utils/cn';

export type StatCardIconColor = 'indigo' | 'emerald' | 'violet' | 'amber' | 'rose' | 'primary';

export interface StatCardProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Metric label (e.g. "Total Revenue", "Active Affiliates") */
  label: string;
  /** Primary metric value (e.g. "$45,231", "1,248") */
  value: string | number;
  /** Icon component to render inside the icon badge */
  icon: React.ComponentType<{ className?: string }>;
  /** Theme color variant for the icon badge */
  iconColor?: StatCardIconColor;
  /** Optional trend indicator */
  trend?: {
    value: string;
    isPositive?: boolean;
    isNeutral?: boolean;
  };
  /** Optional descriptive subtitle or secondary text below the value */
  subtitle?: string;
  /** Custom children (e.g. progress bar or secondary metrics) */
  children?: React.ReactNode;
  /** Test identifier */
  testId?: string;
}

const ICON_COLOR_STYLES: Record<StatCardIconColor, string> = {
  indigo: 'bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 border border-indigo-500/20',
  emerald: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20',
  violet: 'bg-violet-500/10 text-violet-700 dark:text-violet-400 border border-violet-500/20',
  amber: 'bg-amber-500/10 text-amber-800 dark:text-amber-400 border border-amber-500/20',
  rose: 'bg-rose-500/10 text-rose-700 dark:text-rose-400 border border-rose-500/20',
  primary: 'bg-primary/10 text-primary-700 dark:text-primary-400 border border-primary/20',
};

/**
 * Canonical Obsidian Cyber-Glass StatCard Primitive
 *
 * Provides a standardized KPI/metric card layout with:
 * - 40x40px uniform iconography badge (w-10 h-10 rounded-xl)
 * - Standard padding="md" (p-6)
 * - Backdrop blur and adaptive light/dark border styling
 * - Aligned metric typography (uppercase label, bold mono value)
 * - Directional trend indicator pill
 */
export function StatCard({
  label,
  value,
  icon: Icon,
  iconColor = 'primary',
  trend,
  subtitle,
  children,
  className = '',
  testId,
  ...props
}: StatCardProps) {
  const iconStyle = ICON_COLOR_STYLES[iconColor] || ICON_COLOR_STYLES.primary;

  return (
    <div
      className={cn(
        'bg-card dark:bg-[#11131F]',
        'border border-border dark:border-white/[0.08] hover:border-primary/30',
        'rounded-2xl p-6 shadow-sm dark:shadow-[0_4px_24px_-4px_rgba(0,0,0,0.5)]',
        'transition-all duration-300 hover:-translate-y-0.5',
        'group relative overflow-hidden flex flex-col justify-between',
        className
      )}
      data-testid={testId}
      {...props}
    >
      {/* Subtle top highlight — Director's studio lighting */}
      <div
        className="absolute -top-12 -right-12 w-24 h-24 bg-accent/3 dark:bg-accent/5 rounded-full blur-3xl pointer-events-none"
        aria-hidden="true"
      />

      {/* Top row: Uniform Iconography Badge + Trend Indicator */}
      <div className="flex items-center justify-between mb-4">
        <div
          data-testid="stat-card-icon-badge"
          className={cn(
            'w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-transform duration-300 group-hover:scale-105',
            iconStyle
          )}
          aria-hidden="true"
        >
          <Icon className="w-5 h-5" />
        </div>

        {trend && (
          <span
            data-testid="stat-card-trend-pill"
            className={cn(
              'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold shrink-0 border',
              trend.isNeutral
                ? 'text-muted-foreground bg-muted/30 border-border'
                : trend.isPositive === false
                ? 'text-rose-700 dark:text-rose-400 bg-rose-500/10 border-rose-500/20'
                : 'text-emerald-700 dark:text-emerald-400 bg-emerald-500/10 border-emerald-500/20'
            )}
          >
            {trend.isNeutral ? (
              <Minus className="w-3.5 h-3.5 mr-0.5" aria-hidden="true" />
            ) : trend.isPositive === false ? (
              <ArrowDownRight className="w-3.5 h-3.5 mr-0.5" aria-hidden="true" />
            ) : (
              <ArrowUpRight className="w-3.5 h-3.5 mr-0.5" aria-hidden="true" />
            )}
            <span>{trend.value}</span>
          </span>
        )}
      </div>

      {/* Bottom section: Label and Metric Value */}
      <div>
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider block mb-1">
          {label}
        </span>
        <div className="text-2xl lg:text-3xl font-bold text-foreground tracking-tight" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
          {value}
        </div>
        {subtitle && (
          <p className="text-xs text-muted-foreground mt-1">
            {subtitle}
          </p>
        )}
        {children && (
          <div className="mt-3">
            {children}
          </div>
        )}
      </div>
    </div>
  );
}

StatCard.displayName = 'StatCard';
