// i18n-namespace: runbooks
'use client';

import React from 'react';
import Link from 'next/link';
import { ChevronLeft, ChevronRight } from 'lucide-react';
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
      ) : (
        <div />
      )}

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
      ) : (
        <div />
      )}
    </div>
  );
}
