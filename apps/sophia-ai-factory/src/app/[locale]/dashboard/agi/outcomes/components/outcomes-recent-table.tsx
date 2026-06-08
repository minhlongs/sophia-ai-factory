"use client";

import React from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/seed/components/ui/card";

interface OutcomeRow {
  id: string;
  sop: string;
  metric: string;
  value: number;
  date: string;
}

interface OutcomesRecentTableProps {
  rows: OutcomeRow[];
}

function formatValue(metric: string, value: number): string {
  if (metric === "Revenue") return `$${value.toLocaleString()}`;
  if (metric === "CTR") return `${value}%`;
  return value.toLocaleString();
}

export function OutcomesRecentTable({ rows }: OutcomesRecentTableProps) {
  return (
    <Card className="bg-card border-border">
      <CardHeader>
        <CardTitle className="text-sm font-medium text-muted-foreground">
          Recent Outcomes
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">SOP</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Metric</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">Value</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((row) => (
                <tr key={row.id} className="hover:bg-muted/40 transition-colors">
                  <td className="px-6 py-3 text-foreground font-medium">{row.sop}</td>
                  <td className="px-6 py-3 text-muted-foreground">{row.metric}</td>
                  <td className="px-6 py-3 text-right text-cyan-400 font-mono tabular-nums">
                    {formatValue(row.metric, row.value)}
                  </td>
                  <td className="px-6 py-3 text-right text-muted-foreground tabular-nums">{row.date}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
