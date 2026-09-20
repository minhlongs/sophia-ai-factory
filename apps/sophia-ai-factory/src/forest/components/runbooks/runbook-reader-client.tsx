'use client';

/**
 * Customer Runbook Reader Client
 * Layer: forest/components (UI orchestration; imports from @/seed and @/tree)
 *
 * Renders the 10 production-grade customer operational SOPs with sticky sidebar navigation,
 * bilingual toggling (EN/VI), copyable command snippets, offline Markdown & HTML export,
 * master dossier generation, and search filtering.
 *
 * @module forest/components/runbooks/runbook-reader-client
 */

import React, { useState } from 'react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import {
  BookOpen,
  Download,
  Printer,
  Copy,
  Check,
  Search,
  Clock,
  User,
  Calendar,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Tag,
  CheckCircle2,
  Globe,
} from 'lucide-react';
import { cn } from '@/seed/utils/cn';
import { Card } from '@/seed/components/ui/card';
import type { RunbookMetadata, RunbookContent } from '@/seed/handover/handover-types';
import {
  exportRunbookMarkdown,
  exportRunbookHtml,
  exportAllRunbooksMarkdown,
} from '@/tree/handover/runbook-catalog-service';

export interface RunbookReaderClientProps {
  runbooks: RunbookMetadata[];
  activeRunbook: RunbookContent;
  locale: string;
}

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

/**
 * Lightweight parser that formats runbook markdown content into semantic elements
 * with interactive copyable code blocks.
 */
function MarkdownRenderer({ content }: { content: string }) {
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

    // Check code blocks
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

    // Markdown Headers
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
      // Table row (simple display)
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

export function RunbookReaderClient({
  runbooks,
  activeRunbook,
  locale,
}: RunbookReaderClientProps) {
  const t = useTranslations('runbooks');
  const [activeLocale, setActiveLocale] = useState<'en' | 'vi'>(locale === 'vi' ? 'vi' : 'en');
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedAll, setCopiedAll] = useState(false);

  // Find index for pagination
  const currentIndex = runbooks.findIndex((r) => r.slug === activeRunbook.slug);
  const prevRunbook = currentIndex > 0 ? runbooks[currentIndex - 1] : null;
  const nextRunbook = currentIndex >= 0 && currentIndex < runbooks.length - 1 ? runbooks[currentIndex + 1] : null;

  // Filtered runbooks in sidebar
  const filteredRunbooks = runbooks.filter((r) => {
    const title = activeLocale === 'vi' ? r.titleVi : r.titleEn;
    const summary = activeLocale === 'vi' ? r.summaryVi : r.summaryEn;
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    return (
      title.toLowerCase().includes(q) ||
      summary.toLowerCase().includes(q) ||
      r.number.includes(q) ||
      r.category.toLowerCase().includes(q)
    );
  });

  const activeTitle = activeLocale === 'vi' ? activeRunbook.titleVi : activeRunbook.titleEn;
  const activeContent = activeLocale === 'vi' ? activeRunbook.contentVi : activeRunbook.contentEn;

  const handleDownloadMarkdown = () => {
    const content = exportRunbookMarkdown(activeRunbook.slug, activeLocale);
    if (content) {
      downloadBlob(content, `SOP-${activeRunbook.number}-${activeRunbook.slug}.md`, 'text/markdown;charset=utf-8');
    }
  };

  const handleDownloadHtml = () => {
    const content = exportRunbookHtml(activeRunbook.slug, activeLocale);
    if (content) {
      downloadBlob(content, `SOP-${activeRunbook.number}-${activeRunbook.slug}.html`, 'text/html;charset=utf-8');
    }
  };

  const handlePrint = () => {
    const content = exportRunbookHtml(activeRunbook.slug, activeLocale);
    if (!content) return;
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(content);
      printWindow.document.close();
      printWindow.focus();
      setTimeout(() => {
        printWindow.print();
      }, 350);
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
      {/* ── Header ────────────────────────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-border/40 pb-6">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-primary/10 text-primary border border-primary/20">
              <BookOpen className="w-3.5 h-3.5" />
              Sovereign Operations
            </span>
            <span className="text-xs font-medium text-muted-foreground">
              10 Complete Operational SOPs
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
            {t('title')}
          </h1>
          <p className="text-sm text-muted-foreground mt-1 max-w-3xl">
            {t('subtitle')}
          </p>
        </div>

        {/* Global Master Export Button */}
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

      {/* ── 2-Column Responsive Layout ────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* ── Left Sticky Navigation Sidebar ─────────────────────────────────── */}
        <div className="lg:col-span-4 space-y-4 lg:sticky lg:top-8">
          {/* Search Box */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t('searchPlaceholder')}
              className="w-full pl-8 pr-3 py-2 rounded-xl text-xs bg-background border border-border focus:ring-1 focus:ring-primary outline-none"
            />
          </div>

          {/* SOP List Card */}
          <Card className="p-3 border-border/60 bg-card overflow-hidden">
            <div className="space-y-1 max-h-[70vh] overflow-y-auto pr-1">
              {filteredRunbooks.length === 0 ? (
                <div className="p-4 text-center text-xs text-muted-foreground">
                  {t('emptySearch')}
                </div>
              ) : (
                filteredRunbooks.map((r) => {
                  const isActive = r.slug === activeRunbook.slug;
                  const title = activeLocale === 'vi' ? r.titleVi : r.titleEn;

                  return (
                    <Link
                      key={r.id}
                      href={`/dashboard/docs/runbooks/${r.slug}`}
                      className={cn(
                        'block p-3 rounded-lg border transition-all text-left',
                        isActive
                          ? 'bg-primary/10 border-primary/40 text-foreground font-semibold shadow-xs'
                          : 'bg-background hover:bg-muted/40 border-border/40 text-muted-foreground hover:text-foreground',
                      )}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-mono text-[11px] font-bold px-1.5 py-0.5 rounded bg-muted text-foreground">
                          #{r.number}
                        </span>
                        <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {r.readTimeMinutes} {t('readTime')}
                        </span>
                      </div>
                      <div className="text-xs font-semibold line-clamp-1">
                        {title}
                      </div>
                      <div className="text-[11px] text-muted-foreground mt-1 flex items-center gap-1.5">
                        <Tag className="w-3 h-3 text-primary/70" />
                        <span className="truncate">{r.category}</span>
                      </div>
                    </Link>
                  );
                })
              )}
            </div>
          </Card>
        </div>

        {/* ── Right Content Area ─────────────────────────────────────────────── */}
        <div className="lg:col-span-8 space-y-6">
          <Card className="p-6 sm:p-8 border-border/80 shadow-sm bg-card">
            {/* Metadata Bar & Actions */}
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
                  {activeRunbook.readTimeMinutes} {t('readTime')}
                </span>
                <span className="flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5" />
                  {activeRunbook.lastVerified}
                </span>
              </div>

              {/* Language Switcher & Export Actions */}
              <div className="flex flex-wrap items-center gap-2">
                {/* EN / VI Toggle */}
                <div className="flex items-center p-0.5 rounded-lg bg-muted border border-border text-xs">
                  <button
                    type="button"
                    onClick={() => setActiveLocale('en')}
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
                    onClick={() => setActiveLocale('vi')}
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

                {/* Export Buttons */}
                <button
                  type="button"
                  onClick={handleDownloadMarkdown}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-secondary text-secondary-foreground hover:bg-secondary/80 border border-border transition-colors"
                  title={t('downloadMarkdown')}
                >
                  <Download className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">MD</span>
                </button>

                <button
                  type="button"
                  onClick={handleDownloadHtml}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-secondary text-secondary-foreground hover:bg-secondary/80 border border-border transition-colors"
                  title={t('downloadHtml')}
                >
                  <Download className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">HTML</span>
                </button>

                <button
                  type="button"
                  onClick={handlePrint}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-secondary text-secondary-foreground hover:bg-secondary/80 border border-border transition-colors"
                  title="Print / PDF"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Print</span>
                </button>

                <button
                  type="button"
                  onClick={handleCopyText}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-secondary text-secondary-foreground hover:bg-secondary/80 border border-border transition-colors"
                  title="Copy Content"
                >
                  {copiedAll ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                  <span className="hidden sm:inline">{copiedAll ? 'Copied' : 'Copy'}</span>
                </button>
              </div>
            </div>

            {/* Runbook Content Body */}
            <article className="prose dark:prose-invert max-w-none text-foreground">
              <MarkdownRenderer content={activeContent} />
            </article>

            {/* Next / Previous Pagination Footer */}
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
          </Card>
        </div>
      </div>
    </div>
  );
}
