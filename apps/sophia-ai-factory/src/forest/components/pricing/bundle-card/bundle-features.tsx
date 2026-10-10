'use client';

/**
 * Bundle Features List & Checklist Items
 *
 * Layer: forest/components/pricing/bundle-card
 */

import React from 'react';

export function CheckIcon() {
  return (
    <svg
      className="h-4 w-4 shrink-0 text-emerald-400"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M5 13l4 4L19 7"
      />
    </svg>
  );
}

export function FeatureItem({ text }: { text: string }) {
  return (
    <li className="flex items-center gap-2 text-sm text-muted-foreground">
      <CheckIcon />
      {text}
    </li>
  );
}

interface BundleFeaturesProps {
  label: string;
  features: string[];
}

export function BundleFeatures({ label, features }: BundleFeaturesProps) {
  return (
    <div className="mt-6 flex-1">
      <p className="mb-3 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-emerald-400">
        <span aria-hidden="true">&#x1F4E6;</span>
        {label}
      </p>
      <ul className="space-y-2">
        {features.map((f) => (
          <FeatureItem key={f} text={f} />
        ))}
      </ul>
    </div>
  );
}
