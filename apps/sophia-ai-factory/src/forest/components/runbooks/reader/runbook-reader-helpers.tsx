// i18n-namespace: runbooks
'use client';

import React from 'react';
import Link from 'next/link';
import { BookOpen, ChevronLeft, ChevronRight, Download } from 'lucide-react';
import type { RunbookMetadata } from '@/seed/handover/handover-types';
import type { SupportedLocale } from './types';

export function downloadRunbookBlob(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function printRunbookHtmlContent(content: string | null) {
  if (!content) return;
  const printWindow = window.open('', '_blank');
  if (printWindow) {
    printWindow.document.write(content);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => printWindow.print(), 350);
  }
}

export function filterRunbooksByQuery(
  runbooks: RunbookMetadata[],
  activeLocale: SupportedLocale,
  searchQuery: string,
): RunbookMetadata[] {
  const q = searchQuery.toLowerCase().trim();
  if (!q) return runbooks;
  return runbooks.filter((r) => {
    const title = activeLocale === 'vi' ? r.titleVi : r.titleEn;
    const summary = activeLocale === 'vi' ? r.summaryVi : r.summaryEn;
    return title.toLowerCase().includes(q) || summary.toLowerCase().includes(q) || r.number.includes(q) || r.category.toLowerCase().includes(q);
  });
}

export function RunbookReaderHeader({
  title,
  subtitle,
  downloadMasterLabel,
  onDownloadMaster,
}: {
  title: string;
  subtitle: string;
  downloadMasterLabel: string;
  onDownloadMaster: () => void;
}) {
  return (
    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-border/40 pb-6">
      <div>
        <div className="flex items-center gap-2 mb-2">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-primary/10 text-primary border border-primary/20">
            <BookOpen className="w-3.5 h-3.5" />
            Sovereign Operations
          </span>
          <span className="text-xs font-medium text-muted-foreground">10 Complete Operational SOPs</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">{title}</h1>
        <p className="text-sm text-muted-foreground mt-1 max-w-3xl">{subtitle}</p>
      </div>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onDownloadMaster}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm transition-all"
        >
          <Download className="w-3.5 h-3.5" />
          {downloadMasterLabel}
        </button>
      </div>
    </div>
  );
}

export function RunbookPaginationFooter({
  prevRunbook,
  nextRunbook,
  activeLocale,
  t,
}: {
  prevRunbook: RunbookMetadata | null;
  nextRunbook: RunbookMetadata | null;
  activeLocale: SupportedLocale;
  t: (key: string) => string;
}) {
  return (
    <div className="mt-12 pt-6 border-t border-border/50 flex flex-col sm:flex-row items-center justify-between gap-4">
      {prevRunbook ? (
        <Link
          href={`/dashboard/docs/runbooks/${prevRunbook.slug}`}
          className="w-full sm:w-auto inline-flex items-center gap-2 p-3 rounded-lg border border-border hover:border-primary/40 bg-background hover:bg-muted/30 transition-all text-xs text-foreground font-semibold"
        >
          <ChevronLeft className="w-4 h-4 text-primary" />
          <div className="text-left">
            <span className="text-[10px] text-muted-foreground block uppercase font-normal">{t('prevRunbook')}</span>
            <span className="truncate max-w-[200px] block">
              #{prevRunbook.number} {activeLocale === 'vi' ? prevRunbook.titleVi : prevRunbook.titleEn}
            </span>
          </div>
        </Link>
      ) : <div />}

      {nextRunbook ? (
        <Link
          href={`/dashboard/docs/runbooks/${nextRunbook.slug}`}
          className="w-full sm:w-auto inline-flex items-center justify-end gap-2 p-3 rounded-lg border border-border hover:border-primary/40 bg-background hover:bg-muted/30 transition-all text-xs text-foreground font-semibold"
        >
          <div className="text-right">
            <span className="text-[10px] text-muted-foreground block uppercase font-normal">{t('nextRunbook')}</span>
            <span className="truncate max-w-[200px] block">
              #{nextRunbook.number} {activeLocale === 'vi' ? nextRunbook.titleVi : nextRunbook.titleEn}
            </span>
          </div>
          <ChevronRight className="w-4 h-4 text-primary" />
        </Link>
      ) : <div />}
    </div>
  );
}
