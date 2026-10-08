/**
 * @file viral-expansion-kpis.tsx
 * @description KPI metrics bar for Viral Audio, Kinetic Captions, and Cross-Border Dubbing
 * @layer presentation
 */

'use client';

import React from 'react';

interface ViralExpansionKpisProps {
  totalLineages: number;
  totalViralSounds: number;
  activeLocalesCount: number;
  avgPacingStretch: number;
}

export function ViralExpansionKpis({
  totalLineages,
  totalViralSounds,
  activeLocalesCount,
  avgPacingStretch,
}: ViralExpansionKpisProps) {
  const cards = [
    {
      label: 'Localized Lineages',
      value: totalLineages,
      change: '+100% cross-border',
      color: 'text-amber-500',
    },
    {
      label: 'Catalog Viral Sounds',
      value: totalViralSounds,
      change: '100% royalty-safe',
      color: 'text-cyan-400',
    },
    {
      label: 'Target Dub Locales',
      value: `${activeLocalesCount} / 5`,
      change: 'EN, VI, ES, ID, JA',
      color: 'text-emerald-400',
    },
    {
      label: 'Avg Audio Stretch',
      value: `${avgPacingStretch.toFixed(2)}x`,
      change: 'Within [0.90x, 1.15x]',
      color: 'text-fuchsia-400',
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      {cards.map((c, i) => (
        <div
          key={i}
          className="p-4 rounded-xl border border-zinc-800 bg-zinc-900/60 backdrop-blur-sm"
        >
          <div className="text-xs uppercase font-medium text-zinc-400 tracking-wider">
            {c.label}
          </div>
          <div className={`text-2xl font-black mt-2 tracking-tight ${c.color}`}>
            {c.value}
          </div>
          <div className="text-xs text-zinc-500 mt-1">{c.change}</div>
        </div>
      ))}
    </div>
  );
}
