/**
 * Runbook Query Functions.
 * Layer: tree (Domain operations; imports only from @/seed)
 *
 * @module tree/handover/runbook/runbook-queries
 */

import type { RunbookContent, RunbookMetadata } from '@/seed/handover/handover-types';
import { RUNBOOK_CATALOG } from './catalog';

/**
 * Returns metadata list of all 10 runbooks.
 */
export function listRunbooks(_locale: 'en' | 'vi' = 'en'): RunbookMetadata[] {
  return RUNBOOK_CATALOG.map((r) => ({
    id: r.id,
    slug: r.slug,
    number: r.number,
    titleEn: r.titleEn,
    titleVi: r.titleVi,
    summaryEn: r.summaryEn,
    summaryVi: r.summaryVi,
    category: r.category,
    readTimeMinutes: r.readTimeMinutes,
    tags: r.tags,
  }));
}

/**
 * Retrieves a single runbook by its slug.
 */
export function getRunbookBySlug(slug: string, _locale: 'en' | 'vi' = 'en'): RunbookContent | null {
  const cleanSlug = slug.toLowerCase().trim();
  const runbook = RUNBOOK_CATALOG.find((r) => r.slug === cleanSlug || r.id === cleanSlug || r.number === cleanSlug);
  return runbook ?? null;
}
