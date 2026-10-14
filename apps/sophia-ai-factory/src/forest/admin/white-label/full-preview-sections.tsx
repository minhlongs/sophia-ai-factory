/**
 * Hero Banner and Feature Cards Grid for White-Label Full Preview Tab.
 * @module forest/admin/white-label/full-preview-sections
 */

import React from 'react';
import { Sparkles, ArrowRight } from 'lucide-react';
import type { ContrastColorSpec } from '@/seed/types/white-label-branding';

export interface FullPreviewBodyProps {
  agencyName: string;
  primaryColor: string;
  accentColor: string;
  pageTitle: string;
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

export function FullPreviewPortalBody({
  agencyName,
  primaryColor,
  accentColor,
  pageTitle,
  footerText,
  primaryContrast,
  labels,
}: FullPreviewBodyProps) {
  return (
    <>
      {/* Hero Banner */}
      <div className="px-8 py-16 text-center space-y-6 max-w-3xl mx-auto">
        <div
          className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold"
          style={{
            backgroundColor: `${primaryColor}1a`,
            color: primaryColor,
            border: `1px solid ${primaryColor}40`,
          }}
        >
          <Sparkles className="w-3.5 h-3.5" />
          {agencyName ? `${agencyName} White-Label Engine` : 'Sovereign AI Video Infrastructure'}
        </div>

        <h2 className="text-3xl md:text-5xl font-black text-white tracking-tight leading-tight">
          {pageTitle || labels.heroHeading}
        </h2>

        <p className="text-sm md:text-base text-zinc-400 max-w-xl mx-auto leading-relaxed">
          {labels.heroSubheading}
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-2">
          <button
            type="button"
            className="w-full sm:w-auto px-6 py-3 rounded-xl text-sm font-bold shadow-xl flex items-center justify-center gap-2"
            style={{ backgroundColor: primaryColor, color: primaryContrast.hex }}
          >
            <span>{labels.primaryCta}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
          <button
            type="button"
            className="w-full sm:w-auto px-6 py-3 rounded-xl text-sm font-semibold text-zinc-300 border border-zinc-800 hover:bg-zinc-900 transition-colors"
          >
            {labels.secondaryCta}
          </button>
        </div>
      </div>

      {/* Feature Cards Grid */}
      <div className="px-8 pb-16 grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
        {[1, 2, 3].map((idx) => (
          <div
            key={idx}
            className="p-6 rounded-2xl bg-zinc-900/60 border border-zinc-800/80 space-y-3"
            style={{
              borderTop: `2px solid ${idx === 2 ? accentColor : primaryColor}`,
            }}
          >
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center"
              style={{
                backgroundColor: idx === 2 ? `${accentColor}1f` : `${primaryColor}1f`,
                color: idx === 2 ? accentColor : primaryColor,
              }}
            >
              <Sparkles className="w-4 h-4" />
            </div>
            <h4 className="text-sm font-bold text-white">
              {labels.sampleCardTitle} #{idx}
            </h4>
            <p className="text-xs text-zinc-400 leading-relaxed">{labels.sampleCardDesc}</p>
          </div>
        ))}
      </div>

      {/* Footer */}
      <footer className="px-8 py-6 border-t border-zinc-900 text-xs text-zinc-500 text-center">
        {footerText || `© 2026 ${agencyName || 'Sophia AI'}. All rights reserved.`}
      </footer>
    </>
  );
}
