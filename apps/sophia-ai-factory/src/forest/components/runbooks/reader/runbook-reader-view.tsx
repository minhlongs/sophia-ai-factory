'use client';

import React, { useState } from 'react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { BookOpen, Download, ChevronLeft, ChevronRight } from 'lucide-react';
import { Card } from '@/seed/components/ui/card';
import {
  exportRunbookMarkdown,
  exportRunbookHtml,
  exportAllRunbooksMarkdown,
} from '@/tree/handover/runbook-catalog-service';
import type { RunbookReaderClientProps, SupportedLocale } from './types';
import { MarkdownRenderer } from './markdown-renderer';
import { RunbookSidebar } from './runbook-sidebar';
import { RunbookToolbar } from './runbook-toolbar';

function downloadBlob(content: string, filename: string, mimeType: string) {
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

export function RunbookReaderClient({
  runbooks,
  activeRunbook,
  locale,
}: RunbookReaderClientProps) {
  const t = useTranslations('runbooks');
  const [activeLocale, setActiveLocale] = useState<SupportedLocale>(locale === 'vi' ? 'vi' : 'en');
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedAll, setCopiedAll] = useState(false);

  const currentIndex = runbooks.findIndex((r) => r.slug === activeRunbook.slug);
  const prevRunbook = currentIndex > 0 ? runbooks[currentIndex - 1] : null;
  const nextRunbook = currentIndex >= 0 && currentIndex < runbooks.length - 1 ? runbooks[currentIndex + 1] : null;

  const filteredRunbooks = runbooks.filter((r) => {
    const title = activeLocale === 'vi' ? r.titleVi : r.titleEn;
    const summary = activeLocale === 'vi' ? r.summaryVi : r.summaryEn;
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    return title.toLowerCase().includes(q) || summary.toLowerCase().includes(q) || r.number.includes(q) || r.category.toLowerCase().includes(q);
  });

  const activeContent = activeLocale === 'vi' ? activeRunbook.contentVi : activeRunbook.contentEn;

  const handleDownloadMarkdown = () => {
    const content = exportRunbookMarkdown(activeRunbook.slug, activeLocale);
    if (content) downloadBlob(content, `SOP-${activeRunbook.number}-${activeRunbook.slug}.md`, 'text/markdown;charset=utf-8');
  };

  const handleDownloadHtml = () => {
    const content = exportRunbookHtml(activeRunbook.slug, activeLocale);
    if (content) downloadBlob(content, `SOP-${activeRunbook.number}-${activeRunbook.slug}.html`, 'text/html;charset=utf-8');
  };

  const handlePrint = () => {
    const content = exportRunbookHtml(activeRunbook.slug, activeLocale);
    if (!content) return;
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(content);
      printWindow.document.close();
      printWindow.focus();
      setTimeout(() => printWindow.print(), 350);
    }
  };

  const handleDownloadMasterDossier = () => {
    const masterMd = exportAllRunbooksMarkdown(activeLocale);
    downloadBlob(masterMd, `SOPHIA-MASTER-OPERATIONAL-RUNBOOK-DOSSIER-${activeLocale.toUpperCase()}.md`, 'text/markdown;charset=utf-8');
  };

  const handleCopyText = async () => {
    try {
      await navigator.clipboard.writeText(activeContent);
      setCopiedAll(true);
      setTimeout(() => setCopiedAll(false), 2000);
    } catch {
      // ignore
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-border/40 pb-6">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-primary/10 text-primary border border-primary/20">
              <BookOpen className="w-3.5 h-3.5" />
              Sovereign Operations
            </span>
            <span className="text-xs font-medium text-muted-foreground">10 Complete Operational SOPs</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">{t('title')}</h1>
          <p className="text-sm text-muted-foreground mt-1 max-w-3xl">{t('subtitle')}</p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleDownloadMasterDossier}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm transition-all"
          >
            <Download className="w-3.5 h-3.5" />
            {t('downloadMaster')}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        <RunbookSidebar
          filteredRunbooks={filteredRunbooks}
          activeSlug={activeRunbook.slug}
          activeLocale={activeLocale}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          searchPlaceholder={t('searchPlaceholder')}
          emptySearchText={t('emptySearch')}
          readTimeLabel={t('readTime')}
        />

        <div className="lg:col-span-8 space-y-6">
          <Card className="p-6 sm:p-8 border-border/80 shadow-sm bg-card">
            <RunbookToolbar
              activeRunbook={activeRunbook}
              activeLocale={activeLocale}
              copiedAll={copiedAll}
              readTimeLabel={t('readTime')}
              downloadMarkdownLabel={t('downloadMarkdown')}
              downloadHtmlLabel={t('downloadHtml')}
              onLocaleChange={setActiveLocale}
              onDownloadMarkdown={handleDownloadMarkdown}
              onDownloadHtml={handleDownloadHtml}
              onPrint={handlePrint}
              onCopyText={handleCopyText}
            />

            <article className="prose dark:prose-invert max-w-none text-foreground">
              <MarkdownRenderer content={activeContent} />
            </article>

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
          </Card>
        </div>
      </div>
    </div>
  );
}
