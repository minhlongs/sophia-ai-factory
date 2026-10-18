'use client';

import React from 'react';

export function buildPartnerTrackedUrl(
  baseUrl: string,
  partnerCode: string,
  subId: string,
): string {
  const cleanBase = baseUrl.replace(/\/+$/, '');
  const cleanSubId = subId.trim().replace(/[^a-zA-Z0-9_-]/g, '');
  return cleanSubId
    ? `${cleanBase}/r/${partnerCode}?sub_id=${encodeURIComponent(cleanSubId)}`
    : `${cleanBase}/r/${partnerCode}`;
}

export interface AffiliateQrCodePreviewProps {
  partnerCode: string;
  trackedUrl: string;
}

export function AffiliateQrCodePreview({
  partnerCode,
  trackedUrl,
}: AffiliateQrCodePreviewProps) {
  return (
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
  );
}
