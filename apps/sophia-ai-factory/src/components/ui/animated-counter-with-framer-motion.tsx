"use client";

import React from "react";
import { cn } from "@/lib/utils";

interface AnimatedCounterProps {
  value: number;
  className?: string;
  duration?: number;
  prefix?: string;
  suffix?: string;
  decimals?: number;
}

export function AnimatedCounter({
  value,
  className,
  prefix = "",
  suffix = "",
  decimals = 0,
}: AnimatedCounterProps) {
  return (
    <span className={cn("tabular-nums", className)}>
      {prefix}
      {value.toFixed(decimals)}
      {suffix}
    </span>
  );
}

interface AnimatedCounterSimpleProps {
  from?: number;
  to: number;
  className?: string;
  duration?: number;
  prefix?: string;
  suffix?: string;
}

export function AnimatedCounterSimple({
  to,
  className,
  prefix = "",
  suffix = "",
}: AnimatedCounterSimpleProps) {
  return (
    <span className={cn("tabular-nums", className)}>
      {prefix}
      {to}
      {suffix}
    </span>
  );
}
