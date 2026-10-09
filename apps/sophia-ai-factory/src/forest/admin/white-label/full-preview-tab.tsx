/**
 * White-Label Manager Full Live Preview Tab Component.
 *
 * Layer: forest (UI component composition)
 *
 * @module forest/admin/white-label/full-preview-tab
 */

import React from 'react';
import { Sparkles, ArrowRight } from 'lucide-react';
import type { ContrastColorSpec } from '@/seed/types/white-label-branding';

interface FullPreviewTabProps {
  agencyName: string;
  logoUrl: string;
  primaryColor: string;
  accentColor: string;
  pageTitle: string;
  footerText: string;
  primaryContrast: ContrastColorSpec;
  labels: {
    title: string;
    subtitle: string;
    navHome: string;
    navCampaigns: string;
    navAnalytics: string;
    badge: string;
    heroHeading: string;
    heroSubheading: string;
    primaryCta: string;
    secondaryCta: string;
    sampleCardTitle: string;
    sampleCardDesc: string;
  };
}

export function FullPreviewTab({
  agencyName,
  logoUrl,
  primaryColor,
  accentColor,
  pageTitle,
  footerText,
  primaryContrast,
  labels,
}: FullPreviewTabProps) {
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-zinc-900/40 border border-zinc-800 p-4 rounded-xl text-xs text-zinc-400">
        <div>
          <h2 className="text-base font-semibold text-white">{labels.title}</h2>
          <p className="text-xs text-zinc-400 mt-0.5">{labels.subtitle}</p>
        </div>
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1.5 font-mono">
            <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: primaryColor }} />
            Primary: {primaryColor}
          </span>
          <span className="flex items-center gap-1.5 font-mono">
            <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: accentColor }} />
            Accent: {accentColor}
          </span>
        </div>
      </div>

      {/* Full Screen Portal Simulation Card */}
      <div className="rounded-3xl border border-zinc-800 bg-zinc-950 overflow-hidden shadow-2xl">
        {/* Navigation Header */}
        <header className="px-8 py-4 border-b border-zinc-900 flex items-center justify-between backdrop-blur-md bg-zinc-950/80 sticky top-0 z-10">
          <div className="flex items-center gap-3">
            {logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logoUrl} alt="Logo" className="w-8 h-8 object-contain" />
            ) : (
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center font-bold text-sm"
                style={{ backgroundColor: primaryColor, color: primaryContrast.hex }}
              >
                {agencyName ? agencyName.charAt(0).toUpperCase() : 'S'}
              </div>
            )}
            <div>
              <span className="text-sm font-bold text-white tracking-tight">
                {agencyName || 'Sophia AI Factory'}
              </span>
              <div className="text-[10px] text-zinc-400">Enterprise AI Portal</div>
            </div>
          </div>

          <nav className="hidden md:flex items-center gap-6 text-xs font-medium text-zinc-300">
            <span className="text-white hover:text-white cursor-pointer transition-colors">
              {labels.navHome}
            </span>
            <span className="hover:text-white cursor-pointer transition-colors">
              {labels.navCampaigns}
            </span>
            <span className="hover:text-white cursor-pointer transition-colors">
              {labels.navAnalytics}
            </span>
          </nav>

          <div className="flex items-center gap-3">
            <span
              className="px-3 py-1 rounded-full text-xs font-bold"
              style={{ backgroundColor: `${accentColor}26`, color: accentColor }}
            >
              {labels.badge}
            </span>
            <button
              type="button"
              className="px-4 py-2 rounded-xl text-xs font-bold shadow-lg"
              style={{ backgroundColor: primaryColor, color: primaryContrast.hex }}
            >
              {labels.primaryCta}
            </button>
          </div>
        </header>

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
              <p className="text-xs text-zinc-400 leading-relaxed">
                {labels.sampleCardDesc}
              </p>
            </div>
          ))}
        </div>

        {/* Footer */}
        <footer className="px-8 py-6 border-t border-zinc-900 text-xs text-zinc-500 text-center">
          {footerText || `© 2026 ${agencyName || 'Sophia AI'}. All rights reserved.`}
        </footer>
      </div>
    </div>
  );
}
