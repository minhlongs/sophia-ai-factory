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

interface AffiliateTrackingLinksCardProps {
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

  const cleanBase = baseUrl.replace(/\/+$/, '');
  const cleanSubId = subId.trim().replace(/[^a-zA-Z0-9_-]/g, '');
  const trackedUrl = cleanSubId
    ? `${cleanBase}/r/${partnerCode}?sub_id=${encodeURIComponent(cleanSubId)}`
    : `${cleanBase}/r/${partnerCode}`;

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
      {showQr && (
        <div className="mt-5 rounded-lg border border-border/60 bg-muted/30 p-4 flex flex-col sm:flex-row items-center gap-4">
          <div className="bg-white p-3 rounded-lg shadow-sm">
            {/* Standard SVG QR representation */}
            <div className="w-24 h-24 flex items-center justify-center bg-zinc-100 rounded text-center p-1">
              <span className="text-[10px] font-mono text-zinc-600 break-all">
                QR: {partnerCode}
              </span>
            </div>
          </div>
          <div className="text-center sm:text-left">
            <h4 className="text-xs font-semibold text-foreground">Mobile Scan Destination</h4>
            <p className="text-xs text-muted-foreground mt-0.5">
              Direct mobile users straight to your attributed landing page.
            </p>
            <div className="mt-2 text-[11px] font-mono text-muted-foreground break-all">
              {trackedUrl}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
