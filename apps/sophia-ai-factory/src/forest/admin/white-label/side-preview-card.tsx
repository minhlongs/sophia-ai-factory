/**
 * White-Label Manager Side Preview Card.
 *
 * Layer: forest (UI component composition)
 *
 * @module forest/admin/white-label/side-preview-card
 */

import React from 'react';
import { Sparkles } from 'lucide-react';
import type { ContrastColorSpec } from '@/seed/types/white-label-branding';

interface SidePreviewCardProps {
  agencyName: string;
  logoUrl: string;
  primaryColor: string;
  accentColor: string;
  pageTitle: string;
  footerText: string;
  primaryContrast: ContrastColorSpec;
  labels: {
    livePreviewTitle: string;
    livePreviewDescription: string;
    navHome: string;
    navCampaigns: string;
    badge: string;
    heroHeading: string;
    heroSubheading: string;
    primaryCta: string;
    secondaryCta: string;
    sampleCardTitle: string;
    sampleCardDesc: string;
  };
}

export function SidePreviewCard({
  agencyName,
  logoUrl,
  primaryColor,
  accentColor,
  pageTitle,
  footerText,
  primaryContrast,
  labels,
}: SidePreviewCardProps) {
  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-white">{labels.livePreviewTitle}</h3>
        <p className="text-xs text-zinc-400 mt-0.5">{labels.livePreviewDescription}</p>
      </div>

      <div className="rounded-2xl border border-zinc-800 bg-zinc-950 overflow-hidden shadow-2xl">
        {/* Window Bar */}
        <div className="px-4 py-3 bg-zinc-900/90 border-b border-zinc-800 flex items-center gap-2">
          <div className="flex gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-red-500/80" />
            <span className="w-2.5 h-2.5 rounded-full bg-yellow-500/80" />
            <span className="w-2.5 h-2.5 rounded-full bg-green-500/80" />
          </div>
          <div className="mx-auto text-[11px] font-mono text-zinc-400 px-3 py-0.5 rounded bg-zinc-950 border border-zinc-800/80 truncate max-w-[200px]">
            {pageTitle || (agencyName ? `${agencyName} Portal` : 'Sophia AI Factory')}
          </div>
        </div>

        {/* Portal Header */}
        <div className="px-5 py-3 border-b border-zinc-900 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            {logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={logoUrl}
                alt="Brand Logo"
                className="w-6 h-6 object-contain"
                onError={(e) => {
                  (e.target as HTMLElement).style.display = 'none';
                }}
              />
            ) : (
              <div
                className="w-6 h-6 rounded-md flex items-center justify-center text-xs font-bold"
                style={{
                  backgroundColor: primaryColor,
                  color: primaryContrast.hex,
                }}
              >
                {agencyName ? agencyName.charAt(0).toUpperCase() : 'S'}
              </div>
            )}
            <span className="text-xs font-bold text-white tracking-tight">
              {agencyName || 'Sophia AI Studio'}
            </span>
          </div>

          <div className="flex items-center gap-3 text-[11px] text-zinc-400">
            <span className="hover:text-white transition-colors">{labels.navHome}</span>
            <span className="hover:text-white transition-colors">{labels.navCampaigns}</span>
            <span
              className="px-2 py-0.5 rounded-full text-[10px] font-bold"
              style={{
                backgroundColor: `${accentColor}26`,
                color: accentColor,
              }}
            >
              {labels.badge}
            </span>
          </div>
        </div>

        {/* Hero Preview */}
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
      </div>
    </div>
  );
}
