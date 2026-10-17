import React from 'react';
import { Sparkles } from 'lucide-react';
import type { ContrastColorSpec } from '@/seed/types/white-label-branding';

export interface SidePreviewHeroSectionProps {
  agencyName: string;
  primaryColor: string;
  accentColor: string;
  footerText: string;
  primaryContrast: ContrastColorSpec;
  labels: {
    heroHeading: string;
    heroSubheading: string;
    primaryCta: string;
    secondaryCta: string;
    sampleCardTitle: string;
    sampleCardDesc: string;
  };
}

export function SidePreviewHeroSection({
  agencyName,
  primaryColor,
  accentColor,
  footerText,
  primaryContrast,
  labels,
}: SidePreviewHeroSectionProps) {
  return (
    <div className="p-6 space-y-5">
      <div className="space-y-2">
        <div
          className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wide uppercase"
          style={{
            backgroundColor: `${primaryColor}1a`,
            color: primaryColor,
            border: `1px solid ${primaryColor}40`,
          }}
        >
          <Sparkles className="w-3 h-3" />
          White-Label Edge Portal
        </div>
        <h3 className="text-lg font-bold text-white leading-tight">
          {labels.heroHeading}
        </h3>
        <p className="text-xs text-zinc-400 leading-relaxed">
          {labels.heroSubheading}
        </p>
      </div>

      {/* Simulated Buttons */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          className="px-3.5 py-1.5 rounded-lg text-xs font-semibold shadow-md transition-transform hover:scale-105"
          style={{
            backgroundColor: primaryColor,
            color: primaryContrast.hex,
          }}
        >
          {labels.primaryCta}
        </button>
        <button
          type="button"
          className="px-3.5 py-1.5 rounded-lg text-xs font-medium text-zinc-300 border border-zinc-800 hover:bg-zinc-900 transition-colors"
        >
          {labels.secondaryCta}
        </button>
      </div>

      {/* Sample Feature Card */}
      <div
        className="rounded-xl p-3.5 border bg-zinc-900/50 space-y-1.5"
        style={{ borderColor: `${accentColor}33` }}
      >
        <div className="flex items-center gap-2">
          <span
            className="w-2 h-2 rounded-full"
            style={{ backgroundColor: accentColor }}
          />
          <span className="text-xs font-semibold text-white">
            {labels.sampleCardTitle}
          </span>
        </div>
        <p className="text-[11px] text-zinc-400">{labels.sampleCardDesc}</p>
      </div>

      {/* Simulated Footer */}
      <div className="pt-4 border-t border-zinc-900 text-[10px] text-zinc-500 text-center">
        {footerText || `© 2026 ${agencyName || 'Sophia AI'}. All rights reserved.`}
      </div>
    </div>
  );
}
