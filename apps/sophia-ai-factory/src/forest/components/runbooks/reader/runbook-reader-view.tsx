'use client';

import React, { useState } from 'react';
import { useTranslations } from 'next-intl';
import { BookOpen, Download } from 'lucide-react';
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
import {
  downloadRunbookBlob,
  printRunbookHtmlContent,
  RunbookPaginationFooter,
} from './runbook-reader-helpers';

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
    if (content) downloadRunbookBlob(content, `SOP-${activeRunbook.number}-${activeRunbook.slug}.md`, 'text/markdown;charset=utf-8');
  };

  const handleDownloadHtml = () => {
    const content = exportRunbookHtml(activeRunbook.slug, activeLocale);
    if (content) downloadRunbookBlob(content, `SOP-${activeRunbook.number}-${activeRunbook.slug}.html`, 'text/html;charset=utf-8');
  };

  const handlePrint = () => {
    printRunbookHtmlContent(exportRunbookHtml(activeRunbook.slug, activeLocale));
  };

  const handleDownloadMasterDossier = () => {
    const masterMd = exportAllRunbooksMarkdown(activeLocale);
    downloadRunbookBlob(masterMd, `SOPHIA-MASTER-OPERATIONAL-RUNBOOK-DOSSIER-${activeLocale.toUpperCase()}.md`, 'text/markdown;charset=utf-8');
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

            <RunbookPaginationFooter
              prevRunbook={prevRunbook}
              nextRunbook={nextRunbook}
              activeLocale={activeLocale}
              t={(k) => t(k)}
            />
          </Card>
        </div>
      </div>
    </div>
  );
}
