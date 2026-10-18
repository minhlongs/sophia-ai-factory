import React from 'react';
import { cn } from '@/seed/utils/cn';
import {
  ICON_COLOR_STYLES,
  StatCardTrendPill,
  type StatCardIconColor,
  type StatCardTrend,
} from './stat-card-parts';

export type { StatCardIconColor } from './stat-card-parts';

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
  trend?: StatCardTrend;
  /** Optional descriptive subtitle or secondary text below the value */
  subtitle?: string;
  /** Custom children (e.g. progress bar or secondary metrics) */
  children?: React.ReactNode;
  /** Test identifier */
  testId?: string;
}

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

        {trend && <StatCardTrendPill trend={trend} />}
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
