"use client";

/**
 * Feature Item with Checkmark Icon
 * Layer: forest/components/pricing/card
 */

import React from "react";

export function FeatureItem({ text }: { text: string }) {
  return (
    <li className="flex items-center gap-2 text-muted-foreground text-sm">
      <svg
        className="h-4 w-4 shrink-0 text-primary"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
      </svg>
      {text}
    </li>
  );
}
