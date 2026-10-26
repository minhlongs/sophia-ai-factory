'use client';

/**
 * AgentInspectorHud — Client component floating HUD toggle.
 * Provides "Copy LLM Context", view raw Markdown, and One-Click AI Deep-Link Launchers.
 * Layer: forest/components/aeo
 */

import { useState } from 'react';
import type { AeoLocale } from '@/seed/aeo';
import { AgentDeepLinkBar } from './agent-deep-link-bar';

export interface AgentInspectorHudProps {
  readonly markdownContent: string;
  readonly canonicalUrl: string;
  readonly locale: AeoLocale;
}

export function AgentInspectorHud({
  markdownContent,
  canonicalUrl,
  locale,
}: AgentInspectorHudProps) {
  const [copied, setCopied] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const isVi = locale === 'vi';

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(markdownContent);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback if clipboard API is blocked
    }
  };

  return (
    <aside
      aria-label="Agent Inspector HUD"
      className="fixed bottom-4 right-4 z-50 flex flex-col items-end gap-2"
    >
      {isOpen && (
        <div className="w-[320px] sm:w-[400px] max-h-[400px] overflow-y-auto rounded-xl border border-border bg-card/95 p-4 shadow-2xl backdrop-blur-md space-y-2.5">
          <div className="flex items-center justify-between border-b border-border/80 pb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-primary">
              {isVi ? 'Bản Đọc Cho AI (Markdown Twin)' : 'Dual-Read Markdown Twin'}
            </span>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              ✕
            </button>
          </div>
          <pre className="text-[11px] font-mono leading-relaxed text-foreground/90 whitespace-pre-wrap bg-muted/60 p-2.5 rounded-lg border border-border/60">
            {markdownContent.slice(0, 1500)}
            {markdownContent.length > 1500 ? '\n\n... [truncated for HUD preview]' : ''}
          </pre>
          <AgentDeepLinkBar canonicalUrl={canonicalUrl} isVi={isVi} />
          <div className="flex items-center justify-between gap-2 pt-2 border-t border-border/60">
            <a
              href={`${canonicalUrl}.md`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[11px] font-mono text-primary underline hover:text-accent"
            >
              {isVi ? 'Mở trực tiếp file .md' : 'Open raw .md'}
            </a>
            <button
              type="button"
              onClick={handleCopy}
              className="rounded-lg bg-primary px-3 py-1 text-xs font-medium text-primary-foreground hover:bg-primary/90 transition"
            >
              {copied ? (isVi ? '✓ Đã sao chép' : '✓ Copied') : (isVi ? 'Sao chép toàn bộ' : 'Copy Full Context')}
            </button>
          </div>
        </div>
      )}

      <div className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card/90 px-3 py-1.5 shadow-lg backdrop-blur-md">
        <button
          type="button"
          onClick={handleCopy}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-foreground hover:text-primary transition"
        >
          <span className="h-2 w-2 rounded-full bg-accent animate-glow-pulse" />
          <span>{copied ? (isVi ? '✓ Đã sao chép' : '✓ Copied') : 'Copy LLM Context'}</span>
        </button>
        <span className="text-muted-foreground/40">|</span>
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="text-xs font-mono text-muted-foreground hover:text-foreground transition"
          title={isVi ? 'Xem bản đọc của AI Agent' : 'Inspect Agent View'}
        >
          {isOpen ? 'Close' : 'Inspect'}
        </button>
      </div>
    </aside>
  );
}
