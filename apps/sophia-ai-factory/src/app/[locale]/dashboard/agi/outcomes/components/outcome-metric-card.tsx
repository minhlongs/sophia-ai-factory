import React from "react";
import { Card, CardContent } from "@/seed/components/ui/card";

export interface OutcomeMetricCardProps {
  title: string;
  value: string | number;
  change?: number; // percentage change
  icon: React.ReactNode;
}

export function OutcomeMetricCard({
  title,
  value,
  change,
  icon,
}: OutcomeMetricCardProps) {
  const hasChange = change !== undefined;
  const isPositive = hasChange && change >= 0;

  return (
    <Card className="bg-card border-border backdrop-blur-sm">
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <p className="text-sm font-medium text-muted-foreground">{title}</p>
            <p className="text-2xl font-bold text-foreground tabular-nums">
              {value}
            </p>
          </div>
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-cyan-500/10 text-cyan-400">
            {icon}
          </div>
        </div>

        {hasChange && (
          <div className="mt-3">
            <span
              className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                isPositive
                  ? "bg-emerald-500/15 text-emerald-400"
                  : "bg-red-500/15 text-red-400"
              }`}
            >
              {isPositive ? "+" : ""}
              {change.toFixed(1)}% vs last period
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
