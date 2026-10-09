/**
 * Runbook Export Formatters (Markdown, HTML, Dossier).
 * Layer: tree (Domain operations; imports only from @/seed)
 *
 * @module tree/handover/runbook/runbook-export
 */

import { RUNBOOK_CATALOG } from './catalog';
import { getRunbookBySlug } from './runbook-queries';

/**
 * Exports a runbook formatted as standalone Markdown.
 */
export function exportRunbookMarkdown(slug: string, locale: 'en' | 'vi' = 'en'): string | null {
  const runbook = getRunbookBySlug(slug, locale);
  if (!runbook) return null;
  return locale === 'vi' ? runbook.contentVi : runbook.contentEn;
}

/**
 * Exports a runbook formatted as printable HTML.
 */
export function exportRunbookHtml(slug: string, locale: 'en' | 'vi' = 'en'): string | null {
  const runbook = getRunbookBySlug(slug, locale);
  if (!runbook) return null;

  const title = locale === 'vi' ? runbook.titleVi : runbook.titleEn;
  const content = locale === 'vi' ? runbook.contentVi : runbook.contentEn;

  return `<!DOCTYPE html>
<html lang="${locale}">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title} - Sophia Runbook</title>
  <style>
    @page { size: A4 portrait; margin: 20mm; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      line-height: 1.6;
      color: #1f2937;
      max-width: 800px;
      margin: 0 auto;
      padding: 32px 20px;
    }
    h1 { font-size: 24px; color: #111827; border-bottom: 2px solid #e5e7eb; padding-bottom: 8px; }
    h2 { font-size: 18px; color: #374151; margin-top: 24px; }
    h3 { font-size: 15px; color: #4b5563; }
    pre { background: #f3f4f6; padding: 12px; border-radius: 6px; overflow-x: auto; font-size: 12px; }
    code { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; }
    table { width: 100%; border-collapse: collapse; margin: 16px 0; font-size: 13px; }
    th, td { border: 1px solid #e5e7eb; padding: 8px 12px; text-align: left; }
    th { background: #f9fafb; font-weight: 600; }
    .meta { font-size: 12px; color: #6b7280; margin-bottom: 24px; }
    @media print { .no-print { display: none; } }
  </style>
</head>
<body>
  <div class="meta">
    Sophia AI Factory Operational Runbook #${runbook.number} | Last Verified: ${runbook.lastVerified}
  </div>
  <pre style="white-space: pre-wrap; font-family: inherit; background: transparent; padding: 0;">${content}</pre>
</body>
</html>`;
}

/**
 * Exports all 10 runbooks combined into a single master markdown dossier.
 */
export function exportAllRunbooksMarkdown(locale: 'en' | 'vi' = 'en'): string {
  let dossier = `# SOPHIA AI FACTORY — MASTER OPERATIONAL RUNBOOK DOSSIER\n\n`;
  dossier += `> Complete 10-SOP Sovereign Platform Operational Documentation\n`;
  dossier += `> Generated: ${new Date().toISOString()}\n\n`;
  dossier += `## Table of Contents\n\n`;

  RUNBOOK_CATALOG.forEach((r, idx) => {
    const title = locale === 'vi' ? r.titleVi : r.titleEn;
    dossier += `${idx + 1}. [${title}](#sop-${r.number})\n`;
  });
  dossier += `\n---\n\n`;

  RUNBOOK_CATALOG.forEach((r) => {
    dossier += `<a name="sop-${r.number}"></a>\n\n`;
    dossier += locale === 'vi' ? r.contentVi : r.contentEn;
    dossier += `\n\n---\n\n`;
  });

  return dossier;
}
