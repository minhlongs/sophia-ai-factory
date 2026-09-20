/**
 * Runbook Catalog Service & Offline Export Test Suite
 * Tests: loading of all 10 SOPs in EN and VI, Markdown export, and printable HTML generation.
 *
 * @vitest
 */

import { describe, it, expect } from 'vitest';
import {
  RUNBOOK_CATALOG,
  listRunbooks,
  getRunbookBySlug,
  exportRunbookMarkdown,
  exportRunbookHtml,
  exportAllRunbooksMarkdown,
} from '@/tree/handover/runbook-catalog-service';

describe('Runbook Catalog Service & Offline Documentation Package', () => {
  describe('RUNBOOK_CATALOG Integrity', () => {
    it('contains exactly 10 production-grade operational SOPs', () => {
      expect(RUNBOOK_CATALOG).toHaveLength(10);
    });

    it('has sequential numbering from 01 through 10', () => {
      const numbers = RUNBOOK_CATALOG.map((r) => r.number);
      expect(numbers).toEqual(['01', '02', '03', '04', '05', '06', '07', '08', '09', '10']);
    });

    it('has unique IDs and slugs across all SOPs', () => {
      const ids = new Set(RUNBOOK_CATALOG.map((r) => r.id));
      const slugs = new Set(RUNBOOK_CATALOG.map((r) => r.slug));
      expect(ids.size).toBe(10);
      expect(slugs.size).toBe(10);
    });

    it('ensures every runbook has valid bilingual metadata and non-empty content', () => {
      for (const runbook of RUNBOOK_CATALOG) {
        expect(runbook.id).toMatch(/^sop-\d{2}$/);
        expect(runbook.slug.length).toBeGreaterThan(2);
        expect(runbook.titleEn.length).toBeGreaterThan(5);
        expect(runbook.titleVi.length).toBeGreaterThan(5);
        expect(runbook.summaryEn.length).toBeGreaterThan(10);
        expect(runbook.summaryVi.length).toBeGreaterThan(10);
        expect(runbook.category.length).toBeGreaterThan(3);
        expect(runbook.readTimeMinutes).toBeGreaterThan(0);
        expect(runbook.tags.length).toBeGreaterThan(0);
        expect(runbook.author).toBeDefined();
        expect(runbook.lastVerified).toMatch(/^\d{4}-\d{2}-\d{2}$/);

        // Markdown content checks
        expect(runbook.contentEn).toContain('# ');
        expect(runbook.contentVi).toContain('# ');
        expect(runbook.contentEn.length).toBeGreaterThan(200);
        expect(runbook.contentVi.length).toBeGreaterThan(200);

        // Verification of Vietnamese diacritics in contentVi
        expect(runbook.contentVi).toMatch(/[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/i);
      }
    });
  });

  describe('listRunbooks', () => {
    it('returns a list of 10 runbook metadata items', () => {
      const listEn = listRunbooks('en');
      const listVi = listRunbooks('vi');

      expect(listEn).toHaveLength(10);
      expect(listVi).toHaveLength(10);

      // Metadata items should not embed raw contentEn/contentVi
      const first = listEn[0] as unknown as Record<string, unknown>;
      expect(first.contentEn).toBeUndefined();
      expect(first.contentVi).toBeUndefined();
      expect(first.titleEn).toBeDefined();
      expect(first.slug).toBeDefined();
    });
  });

  describe('getRunbookBySlug', () => {
    it('finds runbook by canonical slug', () => {
      const runbook = getRunbookBySlug('quickstart');
      expect(runbook).not.toBeNull();
      expect(runbook?.id).toBe('sop-01');
      expect(runbook?.slug).toBe('quickstart');
    });

    it('finds runbook by ID (e.g. sop-05)', () => {
      const runbook = getRunbookBySlug('sop-05');
      expect(runbook).not.toBeNull();
      expect(runbook?.number).toBe('05');
    });

    it('finds runbook by number (e.g. 03)', () => {
      const runbook = getRunbookBySlug('03');
      expect(runbook).not.toBeNull();
      expect(runbook?.id).toBe('sop-03');
    });

    it('handles case-insensitivity and whitespace trimming', () => {
      const runbookUpper = getRunbookBySlug('  QUICKSTART  ');
      const runbookMixed = getRunbookBySlug('Disaster-Recovery');

      expect(runbookUpper?.id).toBe('sop-01');
      expect(runbookMixed?.id).toBe('sop-08');
    });

    it('returns null for non-existent slugs', () => {
      expect(getRunbookBySlug('non-existent-sop')).toBeNull();
      expect(getRunbookBySlug('')).toBeNull();
    });
  });

  describe('exportRunbookMarkdown', () => {
    it('exports English markdown content for a valid runbook', () => {
      const md = exportRunbookMarkdown('quickstart', 'en');
      expect(md).not.toBeNull();
      expect(md).toContain('# 01. Quickstart & Operator Bootstrap');
      expect(md).toContain('## Step 1: Initial Sign-in');
    });

    it('exports Vietnamese markdown content for a valid runbook', () => {
      const md = exportRunbookMarkdown('quickstart', 'vi');
      expect(md).not.toBeNull();
      expect(md).toContain('# 01. Khởi Động Nhanh & Thiết Lập Vận Hành');
      expect(md).toContain('## Bước 1: Đăng Nhập Lần Đầu');
    });

    it('returns null when exporting invalid runbook slug', () => {
      expect(exportRunbookMarkdown('sop-99', 'en')).toBeNull();
    });
  });

  describe('exportRunbookHtml', () => {
    it('generates self-contained printable HTML document in English', () => {
      const html = exportRunbookHtml('disaster-recovery', 'en');
      expect(html).not.toBeNull();
      expect(html).toContain('<!DOCTYPE html>');
      expect(html).toContain('<html lang="en">');
      expect(html).toContain('<title>');
      expect(html).toContain('@media print');
      expect(html).toContain('Sophia AI Factory Operational Runbook #08');
    });

    it('generates self-contained printable HTML document in Vietnamese', () => {
      const html = exportRunbookHtml('disaster-recovery', 'vi');
      expect(html).not.toBeNull();
      expect(html).toContain('<html lang="vi">');
      expect(html).toContain('Dự Phòng Sự Cố & Phục Hồi Đám Mây');
    });

    it('returns null when exporting HTML for invalid slug', () => {
      expect(exportRunbookHtml('unknown-sop', 'en')).toBeNull();
    });
  });

  describe('exportAllRunbooksMarkdown', () => {
    it('compiles a master dossier containing table of contents and all 10 SOPs', () => {
      const dossierEn = exportAllRunbooksMarkdown('en');
      expect(dossierEn).toContain('# SOPHIA AI FACTORY — MASTER OPERATIONAL RUNBOOK DOSSIER');
      expect(dossierEn).toContain('## Table of Contents');

      for (let i = 1; i <= 10; i++) {
        const numStr = String(i).padStart(2, '0');
        expect(dossierEn).toContain(`<a name="sop-${numStr}"></a>`);
      }

      // Check Vietnamese dossier
      const dossierVi = exportAllRunbooksMarkdown('vi');
      expect(dossierVi).toContain('# SOPHIA AI FACTORY — MASTER OPERATIONAL RUNBOOK DOSSIER');
      expect(dossierVi).toContain('## Table of Contents');
      expect(dossierVi).toContain('Khởi Động Nhanh & Thiết Lập Vận Hành');
    });
  });
});
