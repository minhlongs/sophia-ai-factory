"use client";

import React from "react";
import { cn } from "@/lib/utils";

interface TypewriterEffectProps {
  text: string;
  className?: string;
  speed?: number;
  cursor?: boolean;
  onComplete?: () => void;
}

export function TypewriterEffect({
  text,
  className,
}: TypewriterEffectProps) {
  return (
    <span className={cn("inline-block", className)}>
      {text}
    </span>
  );
}

interface TypewriterLineProps {
  lines: string[];
  className?: string;
  speed?: number;
  lineDelay?: number;
  cursor?: boolean;
}

export function TypewriterLines({
  lines,
  className,
}: TypewriterLineProps) {
  return (
    <div className={cn("space-y-2", className)}>
      {lines.map((line, index) => (
        <div key={index}>
          <span className="inline-block">{line}</span>
        </div>
      ))}
    </div>
  );
}
