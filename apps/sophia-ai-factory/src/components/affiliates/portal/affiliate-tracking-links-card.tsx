'use client';

/**
 * Affiliate Tracking Links Card Component
 *
 * Provides custom sub-ID tagging, dynamic referral URL generation,
 * copy-to-clipboard interactions, and QR code preview toggle.
 *
 * Layer: components/affiliates/portal
 * @module components/affiliates/portal/affiliate-tracking-links-card
 */

import React, { useState } from 'react';
import {
  buildPartnerTrackedUrl,
  AffiliateQrCodePreview,
  type AffiliateQrCodePreviewProps,
} from './affiliate-tracking-qr-preview';

export {
  buildPartnerTrackedUrl,
  AffiliateQrCodePreview,
  type AffiliateQrCodePreviewProps,
};

export interface AffiliateTrackingLinksCardProps {
  partnerCode: string;
  baseUrl?: string;
}

export function AffiliateTrackingLinksCard({
  partnerCode,
  baseUrl = 'https://sophia.agencyos.network',
}: AffiliateTrackingLinksCardProps) {
  const [subId, setSubId] = useState('');
  const [copied, setCopied] = useState(false);
  const [showQr, setShowQr] = useState(false);

  const trackedUrl = buildPartnerTrackedUrl(baseUrl, partnerCode, subId);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(trackedUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
    }
  };

  return (
    <div className="rounded-xl border border-border/70 bg-card p-6 shadow-sm">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-base font-semibold text-foreground">
            Referral Link & Tracking Tag Generator
          </h3>
          <p className="text-xs text-muted-foreground">
            Embed your tracking URL in video descriptions, bios, and landing pages to earn 20% RevShare.
          </p>
        </div>
        <div className="mt-2 sm:mt-0 flex items-center gap-2">
          <span className="inline-flex items-center rounded-md bg-amber-500/10 px-2.5 py-1 text-xs font-mono font-medium text-amber-600 dark:text-amber-400">
            CODE: {partnerCode}
          </span>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-3">
        {/* Sub-ID Input */}
        <div className="sm:col-span-1">
          <label htmlFor="subIdInput" className="block text-xs font-medium text-muted-foreground mb-1.5">
            Campaign Sub-ID (optional)
          </label>
          <input
            id="subIdInput"
            type="text"
            value={subId}
            onChange={(e) => setSubId(e.target.value)}
            placeholder="e.g. tiktok_bio, yt_short_01"
            className="w-full rounded-lg border border-input bg-background px-3 py-2 text-xs font-mono text-foreground placeholder:text-muted-foreground focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
          />
          <p className="mt-1 text-[11px] text-muted-foreground">
            Differentiates traffic channels in analytics.
          </p>
        </div>

        {/* Dynamic Tracked URL Display & Actions */}
        <div className="sm:col-span-2">
          <label className="block text-xs font-medium text-muted-foreground mb-1.5">
            Your Tracked Referral Link
          </label>
          <div className="flex items-center gap-2">
            <input
              type="text"
              readOnly
              value={trackedUrl}
              className="w-full rounded-lg border border-input bg-muted/50 px-3 py-2 text-xs font-mono text-foreground focus:outline-none cursor-text select-all"
            />
            <button
              type="button"
              onClick={handleCopy}
              className={`inline-flex shrink-0 items-center justify-center rounded-lg px-4 py-2 text-xs font-medium transition ${
                copied
                  ? 'bg-emerald-600 text-white'
                  : 'bg-amber-600 hover:bg-amber-500 text-white'
              }`}
            >
              {copied ? 'Copied!' : 'Copy Link'}
            </button>
            <button
              type="button"
              onClick={() => setShowQr(!showQr)}
              className="inline-flex shrink-0 items-center justify-center rounded-lg border border-border bg-card px-3 py-2 text-xs font-medium text-foreground hover:bg-accent transition"
            >
              {showQr ? 'Hide QR' : 'QR Code'}
            </button>
          </div>
        </div>
      </div>

      {/* QR Code Dynamic Container */}
      {showQr && <AffiliateQrCodePreview partnerCode={partnerCode} trackedUrl={trackedUrl} />}
    </div>
  );
}
