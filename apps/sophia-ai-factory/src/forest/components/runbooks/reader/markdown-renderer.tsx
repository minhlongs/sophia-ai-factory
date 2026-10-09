'use client';

import React, { useState } from 'react';
import { Copy, Check } from 'lucide-react';

interface MarkdownRendererProps {
  content: string;
}

/**
 * Lightweight parser that formats runbook markdown content into semantic elements
 * with interactive copyable code blocks.
 */
export function MarkdownRenderer({ content }: MarkdownRendererProps) {
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  const handleCopyCode = async (code: string, idx: number) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedIndex(idx);
      setTimeout(() => setCopiedIndex(null), 2000);
    } catch {
      // ignore
    }
  };

  const lines = content.split('\n');
  const elements: React.ReactNode[] = [];
  let inCodeBlock = false;
  let codeBuffer: string[] = [];
  let codeLang = '';
  let codeBlockIndex = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (line.startsWith('```')) {
      if (!inCodeBlock) {
        inCodeBlock = true;
        codeLang = line.slice(3).trim();
        codeBuffer = [];
      } else {
        inCodeBlock = false;
        const currentIdx = codeBlockIndex++;
        const rawCode = codeBuffer.join('\n');
        elements.push(
          <div key={`code-${i}`} className="my-4 rounded-xl border border-border/80 bg-muted/60 overflow-hidden shadow-xs">
            <div className="flex items-center justify-between px-4 py-2 bg-muted/90 border-b border-border text-[11px] font-mono text-muted-foreground">
              <span>{codeLang || 'terminal'}</span>
              <button
                type="button"
                onClick={() => handleCopyCode(rawCode, currentIdx)}
                className="inline-flex items-center gap-1 hover:text-foreground transition-colors px-2 py-0.5 rounded hover:bg-background"
              >
                {copiedIndex === currentIdx ? (
                  <>
                    <Check className="w-3 h-3 text-emerald-500" />
                    <span className="text-emerald-500 font-sans font-semibold">Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3 h-3" />
                    <span className="font-sans">Copy</span>
                  </>
                )}
              </button>
            </div>
            <pre className="p-4 text-xs font-mono text-foreground overflow-x-auto leading-relaxed">
              <code>{rawCode}</code>
            </pre>
          </div>,
        );
      }
      continue;
    }

    if (inCodeBlock) {
      codeBuffer.push(line);
      continue;
    }

    if (line.startsWith('# ')) {
      elements.push(
        <h1 key={`h1-${i}`} className="text-2xl sm:text-3xl font-black text-foreground tracking-tight mt-6 mb-4 border-b border-border/60 pb-3">
          {line.slice(2)}
        </h1>,
      );
    } else if (line.startsWith('## ')) {
      elements.push(
        <h2 key={`h2-${i}`} className="text-lg sm:text-xl font-bold text-foreground mt-8 mb-3 flex items-center gap-2">
          <span className="w-1.5 h-5 rounded-full bg-primary" />
          {line.slice(3)}
        </h2>,
      );
    } else if (line.startsWith('### ')) {
      elements.push(
        <h3 key={`h3-${i}`} className="text-base font-bold text-foreground mt-5 mb-2">
          {line.slice(4)}
        </h3>,
      );
    } else if (line.startsWith('- ')) {
      elements.push(
        <li key={`li-${i}`} className="text-xs sm:text-sm text-foreground/90 ml-5 list-disc my-1 leading-relaxed">
          {line.slice(2)}
        </li>,
      );
    } else if (/^\d+\.\s/.test(line)) {
      elements.push(
        <li key={`oli-${i}`} className="text-xs sm:text-sm text-foreground/90 ml-5 list-decimal my-1.5 leading-relaxed">
          {line.replace(/^\d+\.\s/, '')}
        </li>,
      );
    } else if (line.startsWith('|')) {
      elements.push(
        <div key={`tbl-${i}`} className="text-xs font-mono py-1 px-2 border-b border-border/30 bg-muted/20">
          {line}
        </div>,
      );
    } else if (line.trim().length > 0) {
      elements.push(
        <p key={`p-${i}`} className="text-xs sm:text-sm text-foreground/90 leading-relaxed my-3">
          {line}
        </p>,
      );
    }
  }

  return <div className="space-y-1">{elements}</div>;
}
