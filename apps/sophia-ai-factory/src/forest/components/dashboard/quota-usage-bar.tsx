"use client";

import { useMemo } from "react";
import { Link } from '@/seed/navigation';
import { BarChart3, ArrowUpRight } from "lucide-react";
import { Button } from "@/seed/components/ui/button";

interface QuotaUsageBarProps {
  /** Labels: used, total */
  used: number;
  total: number;
  /** What resource (e.g., "campaigns", "videos") */
  label: string;
  /** Route for upgrade CTA */
  upgradeHref?: string;
}

export function QuotaUsageBar({ used, total, label, upgradeHref = "/pricing" }: QuotaUsageBarProps) {
  const pct = useMemo(() => Math.min(100, Math.round((used / Math.max(1, total)) * 100)), [used, total]);
  const isWarning = pct >= 80;
  const isCritical = pct >= 95;
  const isUnlimited = total >= 999;

  if (isUnlimited) return null;

  const barColor = isCritical ? "bg-red-500" : isWarning ? "bg-amber-500" : "bg-primary";

  return (
    <div className="rounded-xl border bg-card p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-medium">
          <BarChart3 className="h-4 w-4 text-muted-foreground" />
          <span>{label}</span>
          <span className="text-muted-foreground">
            {used}/{total}
          </span>
        </div>
        {isWarning && (
          <Button size="sm" variant="outline" asChild className="h-7 text-xs gap-1">
            <Link href={upgradeHref}>
              <ArrowUpRight className="h-3 w-3" />
              Upgrade
            </Link>
          </Button>
        )}
      </div>
      <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${barColor}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      {isCritical && (
        <p className="text-xs text-red-500">Almost at limit — upgrade to continue creating</p>
      )}
      {isWarning && !isCritical && (
        <p className="text-xs text-amber-500">Approaching limit — unlock more with a higher tier</p>
      )}
    </div>
  );
}
