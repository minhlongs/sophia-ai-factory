"use client";

import { useState } from "react";
import { Copy, Check } from "lucide-react";
import { cn } from '@/seed/utils/cn';

interface GuideCodeBlockProps {
  code: string;
  language?: string;
  className?: string;
}

export function GuideCodeBlock({ code, language, className }: GuideCodeBlockProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className={cn(
      "relative bg-muted/30 border border-border/40 rounded-xl overflow-hidden",
      className
    )}>
      {/* Header bar */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-border/40 bg-muted/20">
        {language && (
          <span className="text-xs text-muted-foreground/60 font-mono uppercase tracking-wider">
            {language}
          </span>
        )}
        <button
          onClick={handleCopy}
          className="ml-auto flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors px-2 py-1 rounded hover:bg-muted/50"
          aria-label="Sao chép mã"
        >
          {copied ? (
            <>
              <Check className="w-3.5 h-3.5 text-accent" aria-hidden="true" />
              <span className="text-accent">Đã sao chép!</span>
            </>
          ) : (
            <>
              <Copy className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Sao chép</span>
            </>
          )}
        </button>
      </div>
      {/* Code content */}
      <pre className="px-4 py-4 overflow-x-auto text-sm font-mono text-muted-foreground leading-relaxed whitespace-pre">
        <code>{code}</code>
      </pre>
    </div>
  );
}
