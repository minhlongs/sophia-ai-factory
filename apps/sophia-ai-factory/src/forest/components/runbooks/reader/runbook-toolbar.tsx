import React from 'react';
import { Clock, Calendar, Globe, Download, Printer, Check, Copy } from 'lucide-react';
import { cn } from '@/seed/utils/cn';
import type { RunbookContent } from '@/seed/handover/handover-types';
import type { SupportedLocale } from './types';

interface RunbookToolbarProps {
  activeRunbook: RunbookContent;
  activeLocale: SupportedLocale;
  copiedAll: boolean;
  readTimeLabel: string;
  downloadMarkdownLabel: string;
  downloadHtmlLabel: string;
  onLocaleChange: (loc: SupportedLocale) => void;
  onDownloadMarkdown: () => void;
  onDownloadHtml: () => void;
  onPrint: () => void;
  onCopyText: () => void;
}

export function RunbookToolbar({
  activeRunbook,
  activeLocale,
  copiedAll,
  readTimeLabel,
  downloadMarkdownLabel,
  downloadHtmlLabel,
  onLocaleChange,
  onDownloadMarkdown,
  onDownloadHtml,
  onPrint,
  onCopyText,
}: RunbookToolbarProps) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border/50 pb-5 mb-6">
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <span className="px-2.5 py-0.5 rounded-full font-bold bg-primary/10 text-primary border border-primary/20">
          SOP #{activeRunbook.number}
        </span>
        <span className="px-2.5 py-0.5 rounded-full bg-muted font-medium text-foreground">
          {activeRunbook.category}
        </span>
        <span className="flex items-center gap-1">
          <Clock className="w-3.5 h-3.5" />
          {activeRunbook.readTimeMinutes} {readTimeLabel}
        </span>
        <span className="flex items-center gap-1">
          <Calendar className="w-3.5 h-3.5" />
          {activeRunbook.lastVerified}
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center p-0.5 rounded-lg bg-muted border border-border text-xs">
          <button
            type="button"
            onClick={() => onLocaleChange('en')}
            className={cn(
              'px-2.5 py-1 rounded font-medium transition-colors flex items-center gap-1',
              activeLocale === 'en'
                ? 'bg-background text-foreground shadow-xs'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            <Globe className="w-3 h-3" />
            EN
          </button>
          <button
            type="button"
            onClick={() => onLocaleChange('vi')}
            className={cn(
              'px-2.5 py-1 rounded font-medium transition-colors flex items-center gap-1',
              activeLocale === 'vi'
                ? 'bg-background text-foreground shadow-xs'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            <Globe className="w-3 h-3" />
            VI
          </button>
        </div>

        <button
          type="button"
          onClick={onDownloadMarkdown}
          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-secondary text-secondary-foreground hover:bg-secondary/80 border border-border transition-colors"
          title={downloadMarkdownLabel}
        >
          <Download className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">MD</span>
        </button>

        <button
          type="button"
          onClick={onDownloadHtml}
          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-secondary text-secondary-foreground hover:bg-secondary/80 border border-border transition-colors"
          title={downloadHtmlLabel}
        >
          <Download className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">HTML</span>
        </button>

        <button
          type="button"
          onClick={onPrint}
          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-secondary text-secondary-foreground hover:bg-secondary/80 border border-border transition-colors"
          title="Print / PDF"
        >
          <Printer className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Print</span>
        </button>

        <button
          type="button"
          onClick={onCopyText}
          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-secondary text-secondary-foreground hover:bg-secondary/80 border border-border transition-colors"
          title="Copy Content"
        >
          {copiedAll ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
          <span className="hidden sm:inline">{copiedAll ? 'Copied' : 'Copy'}</span>
        </button>
      </div>
    </div>
  );
}
