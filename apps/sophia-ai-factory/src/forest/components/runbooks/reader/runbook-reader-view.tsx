'use client';

import React, { useState } from 'react';
import { useTranslations } from 'next-intl';
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
  filterRunbooksByQuery,
  printRunbookHtmlContent,
  RunbookPaginationFooter,
  RunbookReaderHeader,
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
  const filteredRunbooks = filterRunbooksByQuery(runbooks, activeLocale, searchQuery);
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
      <RunbookReaderHeader
        title={t('title')}
        subtitle={t('subtitle')}
        downloadMasterLabel={t('downloadMaster')}
        onDownloadMaster={handleDownloadMasterDossier}
      />

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
