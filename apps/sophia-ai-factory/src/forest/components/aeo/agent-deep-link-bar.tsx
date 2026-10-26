'use client';

/**
 * AgentDeepLinkBar — One-Click Deep-Link Prompt Launcher for ChatGPT, Claude, and Perplexity.
 * Strictly redacts PII/BYOK secrets before constructing external query strings.
 * Layer: forest/components/aeo
 */

import { buildLlmDeepLinkUrls } from '@/seed/aeo';

export interface AgentDeepLinkBarProps {
  readonly canonicalUrl: string;
  readonly isVi: boolean;
  readonly contextSnippet?: string;
}

export function AgentDeepLinkBar({
  canonicalUrl,
  isVi,
  contextSnippet,
}: AgentDeepLinkBarProps) {
  const urls = buildLlmDeepLinkUrls({
    canonicalUrl,
    isVi,
    contextSnippet,
  });

  const links = [
    { key: 'chatgpt', label: 'ChatGPT', href: urls.chatgpt },
    { key: 'claude', label: 'Claude', href: urls.claude },
    { key: 'perplexity', label: 'Perplexity', href: urls.perplexity },
  ] as const;

  return (
    <div
      aria-label={isVi ? 'Mở nhanh trên các nền tảng AI' : 'One-Click AI Prompt Launcher'}
      className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-border/60"
    >
      <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mr-1">
        {isVi ? 'Hỏi AI ngay:' : 'Ask AI:'}
      </span>
      {links.map((item) => (
        <a
          key={item.key}
          href={item.href}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 rounded-md border border-border/80 bg-muted/50 px-2 py-0.5 text-[11px] font-mono font-medium text-foreground hover:border-primary/60 hover:text-primary transition"
        >
          <span>↗</span>
          <span>{item.label}</span>
        </a>
      ))}
    </div>
  );
}
