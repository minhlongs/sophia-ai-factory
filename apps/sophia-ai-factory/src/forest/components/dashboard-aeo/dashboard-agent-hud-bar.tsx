'use client';

/**
 * DashboardAgentHudBar — Spatial Bento 2027 Command & Safe LLM Context Export Bar
 * for all 16+ authenticated Dashboard modules.
 * Strictly enforces mode="authenticated-safe" (zero BYOK/PII leakage, no public indexing).
 * Layer: forest/components/dashboard-aeo
 */

import { useState } from 'react';
import {
  resolveDashboardModuleDescriptor,
  serializeSafeDashboardContext,
} from './dashboard-context-serializer';

export interface DashboardAgentHudBarProps {
  readonly pathname: string;
  readonly isVi: boolean;
  readonly tier?: string;
  readonly quotaUsed?: number;
  readonly quotaTotal?: number;
}

export function DashboardAgentHudBar({
  pathname,
  isVi,
  tier = 'BASIC',
  quotaUsed = 0,
  quotaTotal = 1000,
}: DashboardAgentHudBarProps) {
  const [copied, setCopied] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  const descriptor = resolveDashboardModuleDescriptor(pathname);
  const safeMarkdown = serializeSafeDashboardContext({
    pathname,
    isVi,
    tier,
    quotaUsed,
    quotaTotal,
  });

  const handleCopySafeContext = async () => {
    try {
      await navigator.clipboard.writeText(safeMarkdown);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard blocked fallback
    }
  };

  return (
    <section
      aria-label={isVi ? 'Thanh Điều Khiển AI An Toàn' : 'Authenticated-Safe AI Context Bar'}
      className="mb-6 rounded-xl border border-border/80 bg-card/85 p-3.5 sm:p-4 shadow-sm backdrop-blur-md"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="h-2 w-2 shrink-0 rounded-full bg-accent animate-glow-pulse" />
          <div className="truncate">
            <p className="text-xs font-bold uppercase tracking-wider text-primary truncate">
              {isVi ? descriptor.titleVi : descriptor.titleEn}
            </p>
            <p className="text-[11px] text-muted-foreground truncate">
              {isVi ? descriptor.purposeVi : descriptor.purposeEn}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <span className="hidden sm:inline-flex items-center rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 text-[10px] font-mono font-semibold text-emerald-400">
            {isVi ? 'Bảo mật: Đã ẩn khóa BYOK' : 'PII & BYOK Scrubbed'}
          </span>

          <button
            type="button"
            onClick={() => setShowPreview(!showPreview)}
            className="rounded-lg border border-border px-2.5 py-1 text-xs font-mono text-muted-foreground hover:text-foreground transition"
          >
            {showPreview ? (isVi ? 'Ẩn' : 'Hide') : (isVi ? 'Xem Context' : 'Preview')}
          </button>

          <button
            type="button"
            onClick={handleCopySafeContext}
            className="rounded-lg bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground hover:bg-primary/90 transition"
          >
            {copied
              ? (isVi ? '✓ Đã chép Context an toàn' : '✓ Safe Context Copied')
              : (isVi ? 'Copy Safe LLM Context' : 'Copy Safe LLM Context')}
          </button>
        </div>
      </div>

      {showPreview && (
        <pre className="mt-3 max-h-48 overflow-y-auto rounded-lg border border-border/60 bg-muted/60 p-3 text-[11px] font-mono leading-relaxed text-foreground/90 whitespace-pre-wrap">
          {safeMarkdown}
        </pre>
      )}
    </section>
  );
}
