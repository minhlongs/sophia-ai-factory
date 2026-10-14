/**
 * StatusBadge component for benchmark metrics.
 */

import React from "react";
import type { BenchmarkItem } from "./types";

const STYLES: Record<BenchmarkItem["status"], string> = {
  pass: "bg-emerald-900/40 text-emerald-300 border border-emerald-700",
  warning: "bg-amber-900/40 text-amber-300 border border-amber-700",
  info: "bg-blue-900/40 text-blue-300 border border-blue-700",
};

const LABELS: Record<BenchmarkItem["status"], string> = {
  pass: "PASS",
  warning: "WARN",
  info: "INFO",
};

export function StatusBadge({ status }: { status: BenchmarkItem["status"] }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${STYLES[status]}`}>
      {LABELS[status]}
    </span>
  );
}
