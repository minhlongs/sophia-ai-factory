'use client';

import React, { useState, useEffect } from 'react';
import type { BridgePageData } from '@/tree/affiliate/bridge/bridge-page-types';

interface BridgeClientViewProps {
  data: BridgePageData;
}

export function BridgeClientView({ data }: BridgeClientViewProps) {
  const [copied, setCopied] = useState(false);
  const [timeLeft, setTimeLeft] = useState(data.vanityCoupon.expiresInSeconds);

  useEffect(() => {
    if (timeLeft <= 0) return;
    const interval = setInterval(() => {
      setTimeLeft((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(interval);
  }, [timeLeft]);

  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;
  const formattedTime = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

  const handleCopyCoupon = async () => {
    try {
      await navigator.clipboard.writeText(data.vanityCoupon.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Graceful fallback for non-secure contexts
    }
  };

  const isVi = data.locale === 'vi';

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4 py-8 text-foreground selection:bg-primary selection:text-primary-foreground sm:py-12">
      <main className="w-full max-w-lg space-y-6 rounded-2xl border border-border bg-card p-6 shadow-xl sm:p-8">
        {/* Urgency Badge */}
        <div className="flex items-center justify-between rounded-xl border border-primary/20 bg-primary/10 px-4 py-2.5 text-xs font-semibold text-primary">
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-2 w-2 animate-ping rounded-full bg-primary" />
            {isVi ? 'Ưu Đãi Đặc Quyền Giới Hạn' : 'Limited Exclusive Partner Deal'}
          </span>
          <span className="font-mono text-sm tracking-wider">{formattedTime}</span>
        </div>

        {/* Headlines */}
        <div className="space-y-2 text-center">
          <h1 className="text-2xl font-extrabold tracking-tight text-foreground sm:text-3xl">
            {data.headline}
          </h1>
          <p className="text-sm leading-relaxed text-muted-foreground">
            {data.subheadline}
          </p>
        </div>

        {/* Video Teaser Preview */}
        <div className="relative aspect-video w-full overflow-hidden rounded-xl border border-border bg-muted/60 shadow-inner">
          <div className="flex h-full w-full flex-col items-center justify-center gap-2 p-4 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/20 text-primary shadow-lg ring-4 ring-primary/10 transition-transform hover:scale-105">
              <svg className="h-7 w-7 translate-x-0.5 fill-current" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z" />
              </svg>
            </div>
            <span className="text-xs font-medium text-muted-foreground">
              {isVi ? 'Xem demo thực chiến 60s' : 'Watch 60s live demo'}
            </span>
          </div>
        </div>

        {/* Feature Bullets */}
        <div className="space-y-2.5 rounded-xl border border-border/60 bg-background/50 p-4">
          {data.bulletPoints.map((bullet, idx) => (
            <div key={idx} className="flex items-start gap-2.5 text-xs text-foreground sm:text-sm">
              <svg className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
              </svg>
              <span>{bullet}</span>
            </div>
          ))}
        </div>

        {/* Vanity Coupon Box */}
        <div className="flex flex-col items-center justify-between gap-3 rounded-xl border border-dashed border-primary/40 bg-primary/5 p-4 sm:flex-row">
          <div className="text-center sm:text-left">
            <p className="text-xs text-muted-foreground">{data.vanityCoupon.discountText}</p>
            <p className="font-mono text-base font-bold text-foreground sm:text-lg">
              {data.vanityCoupon.code}
            </p>
          </div>
          <button
            type="button"
            onClick={handleCopyCoupon}
            className="w-full rounded-lg bg-secondary px-4 py-2 text-xs font-semibold text-secondary-foreground transition-colors hover:bg-secondary/80 sm:w-auto"
          >
            {copied ? (isVi ? 'Đã sao chép!' : 'Copied!') : (isVi ? 'Sao chép mã' : 'Copy Code')}
          </button>
        </div>

        {/* Primary Direct Affiliate CTA */}
        <a
          href={data.destinationUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-6 py-3.5 text-sm font-bold text-primary-foreground shadow-lg transition-transform hover:scale-[1.02] active:scale-[0.98]"
        >
          <span>{data.ctaLabel}</span>
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M14 5l7 7m0 0l-7 7m7-7H3" />
          </svg>
        </a>

        {/* Footer & Geo Verification */}
        <div className="flex items-center justify-center gap-3 text-[11px] text-muted-foreground">
          <span>🛡️ {isVi ? 'Chứng nhận đối tác chính thức' : 'Official Verified Partner'}</span>
          <span>•</span>
          <span>📍 {data.country}</span>
        </div>
      </main>
    </div>
  );
}
