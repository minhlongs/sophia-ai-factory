"use client";

import React from "react";

export function Stars({ avg }: { avg: number }) {
  const full = Math.floor(avg);
  const half = avg - full >= 0.5;
  return (
    <span
      className="text-amber-400"
      aria-label={`${avg.toFixed(1)} out of 5 stars`}
    >
      {"★".repeat(full)}
      {half ? "⯪" : ""}
      {"☆".repeat(5 - full - (half ? 1 : 0))}
    </span>
  );
}

export function formatSales(count: number): string {
  if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(1)}M`;
  if (count >= 1_000) return `${(count / 1_000).toFixed(1)}K`;
  return String(count);
}
