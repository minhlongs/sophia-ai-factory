/**
 * White-Label Manager Full Live Preview Tab Component.
 *
 * Layer: forest (UI component composition)
 *
 * @module forest/admin/white-label/full-preview-tab
 */

import React from 'react';
import type { ContrastColorSpec } from '@/seed/types/white-label-branding';
import { FullPreviewPortalBody } from './full-preview-sections';

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

        <FullPreviewPortalBody
          agencyName={agencyName}
          primaryColor={primaryColor}
          accentColor={accentColor}
          pageTitle={pageTitle}
          footerText={footerText}
          primaryContrast={primaryContrast}
          labels={labels}
        />
      </div>
    </div>
  );
}
