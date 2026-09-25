/**
 * Unit Test Suite: AI Meeting Prep & Bilingual Enterprise Solution Proposal
 *
 * Validates:
 * 1. AI Meeting Prep dossier formatting and objection battlecards
 * 2. Dossier generation & deal transition to 'demo_prepared'
 * 3. Bilingual proposal quality verification (word count >= 1200 words, 7 mandatory sections)
 * 4. Section parsing from markdown
 * 5. Full proposal generation in English and Vietnamese
 * 6. Deal transition to 'proposal_sent'
 *
 * @module __tests__/unit/enterprise/meeting-prep-and-proposal.test
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { createRequire } from 'node:module';
import { makeD1 } from '@/__tests__/integration/shared-d1-shim';
import {
  formatDossierMarkdown,
  generateMeetingPrepDossier,
} from '@/tree/sales/meeting-prep-service';
import {
  countWords,
  verifyProposalQuality,
  parseProposalSections,
  generateEnterpriseProposal,
} from '@/tree/sales/enterprise-proposal-service';
import { createEnterpriseDeal, getEnterpriseDealById } from '@/tree/sales/enterprise-deal-repo';

const req = createRequire(import.meta.url);
const { DatabaseSync } = req('node:sqlite') as {
  DatabaseSync: new (path: string) => {
    exec(sql: string): void;
    prepare(sql: string): any;
  };
};

describe('Meeting Prep & Proposal Generation — Unit Tests', () => {
  let rawDb: any;
  let d1: any;

  beforeEach(() => {
    rawDb = new DatabaseSync(':memory:');
    rawDb.exec(`
      CREATE TABLE IF NOT EXISTS enterprise_deals (
        id TEXT PRIMARY KEY,
        lead_name TEXT NOT NULL,
        lead_email TEXT NOT NULL,
        lead_phone TEXT,
        lead_title TEXT,
        company_name TEXT NOT NULL,
        company_domain TEXT NOT NULL,
        lead_source TEXT NOT NULL DEFAULT 'website',
        deal_stage TEXT NOT NULL DEFAULT 'new_lead',
        pipeline_tier TEXT NOT NULL DEFAULT 'cold',
        deal_value_estimate_cents INTEGER NOT NULL DEFAULT 0,
        currency TEXT NOT NULL DEFAULT 'USD',
        requested_mcu_monthly INTEGER NOT NULL DEFAULT 0,
        bant_score INTEGER NOT NULL DEFAULT 0,
        bant_budget_score INTEGER NOT NULL DEFAULT 0,
        bant_authority_score INTEGER NOT NULL DEFAULT 0,
        bant_need_score INTEGER NOT NULL DEFAULT 0,
        bant_timeline_score INTEGER NOT NULL DEFAULT 0,
        bant_analysis_json TEXT NOT NULL DEFAULT '{}',
        assigned_agent_id TEXT,
        assigned_agent_role TEXT NOT NULL DEFAULT 'ai_sales_executive',
        meeting_prep_brief TEXT,
        proposal_id TEXT,
        proposal_language TEXT NOT NULL DEFAULT 'en',
        proposal_content TEXT,
        sandbox_subaccount_id TEXT,
        sandbox_status TEXT NOT NULL DEFAULT 'none',
        sandbox_token TEXT,
        sandbox_expires_at INTEGER,
        notes TEXT,
        metadata_json TEXT NOT NULL DEFAULT '{}',
        created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000),
        updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000)
      );

      CREATE TABLE IF NOT EXISTS enterprise_lead_enrichments (
        id TEXT PRIMARY KEY,
        deal_id TEXT,
        domain TEXT NOT NULL,
        company_name TEXT,
        industry TEXT,
        employee_count_range TEXT,
        estimated_annual_revenue TEXT,
        headquarters_location TEXT,
        country TEXT,
        tech_stack_json TEXT NOT NULL DEFAULT '[]',
        linkedin_company_url TEXT,
        twitter_handle TEXT,
        enrichment_source TEXT NOT NULL DEFAULT 'heuristic',
        confidence_score REAL NOT NULL DEFAULT 1.0,
        raw_payload_json TEXT NOT NULL DEFAULT '{}',
        status TEXT NOT NULL DEFAULT 'completed',
        created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000),
        updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000)
      );
    `);

    d1 = makeD1(rawDb);
  });

  describe('1. AI Meeting Prep Dossier', () => {
    it('formats dossier markdown with company overview, pain points, and battlecards', async () => {
      const deal = await createEnterpriseDeal(d1, {
        leadName: 'Bui Quang Tien',
        leadEmail: 'tien.bui@vietcorp.vn',
        companyName: 'VietCorp Media',
        companyDomain: 'vietcorp.vn',
        dealValueEstimateCents: 5400000,
        requestedMcuMonthly: 100000,
      });

      const markdown = formatDossierMarkdown(
        deal,
        'VietCorp Media is a premier digital media group in Vietnam.',
        'CMO & Head of Video Production.',
        'High manual editing cost and multi-week localization turnaround.',
        'Deploy Sophia APAC 5-Language Voice Dubbing with Edge HLS Streaming.',
        'Propose 100,000 MCU/month Enterprise Growth tier.',
        [
          {
            competitorOrObjection: 'Traditional Agency',
            ourDifferentiator: '10x Cheaper & 100x Faster',
            talkingPoint: 'Under 90s per video render vs 2 weeks agency turnaround.',
          },
        ]
      );

      expect(markdown).toContain('Executive Sales Dossier: VietCorp Media');
      expect(markdown).toContain('1. Company & Stakeholder Snapshot');
      expect(markdown).toContain('2. Quantified Pain Points & Automation Opportunities');
      expect(markdown).toContain('4. Competitive Battlecards & Objection Playbook');
      expect(markdown).toContain('Traditional Agency');
    });

    it('generates meeting prep dossier and updates deal stage to demo_prepared', async () => {
      const deal = await createEnterpriseDeal(d1, {
        leadName: 'Sarah Jenkins',
        leadEmail: 'sarah@globaltech.com',
        companyName: 'GlobalTech Media',
        companyDomain: 'globaltech.com',
        dealStage: 'qualified',
      });

      const dossier = await generateMeetingPrepDossier(d1, deal.id);
      expect(dossier.dealId).toBe(deal.id);
      expect(dossier.battlecards.length).toBeGreaterThan(0);
      expect(dossier.fullBriefMarkdown.length).toBeGreaterThan(100);

      const refreshed = await getEnterpriseDealById(d1, deal.id);
      expect(refreshed!.meetingPrepBrief).not.toBeNull();
      expect(refreshed!.dealStage).toBe('demo_prepared');
    });
  });

  describe('2. Bilingual Enterprise Proposal Generator', () => {
    it('accurately counts words in markdown text', () => {
      expect(countWords('hello world from sophia')).toBe(4);
      expect(countWords('   multiline \n\n text   with   spaces  ')).toBe(4);
    });

    it('verifies English proposal quality criteria (>= 1,200 words and 7 sections)', async () => {
      const deal = await createEnterpriseDeal(d1, {
        leadName: 'Marcus Wong',
        leadEmail: 'marcus@singapore-media.sg',
        companyName: 'Singapore Media Holdings',
        companyDomain: 'singapore-media.sg',
        dealValueEstimateCents: 6000000,
        requestedMcuMonthly: 120000,
      });

      const result = await generateEnterpriseProposal(d1, deal.id, 'en');
      expect(result.language).toBe('en');
      expect(result.wordCount).toBeGreaterThanOrEqual(1200);
      expect(result.qualityPassed).toBe(true);
      expect(result.sections.length).toBeGreaterThanOrEqual(7);

      // Verify sections parsing
      const titles = result.sections.map((s) => s.title);
      expect(titles.some((t) => t.includes('Executive Summary'))).toBe(true);
      expect(titles.some((t) => t.includes('Strategic Objectives'))).toBe(true);
      expect(titles.some((t) => t.includes('Architecture Blueprint'))).toBe(true);
      expect(titles.some((t) => t.includes('SLA Commitments'))).toBe(true);
      expect(titles.some((t) => t.includes('Commercial Terms'))).toBe(true);
      expect(titles.some((t) => t.includes('Implementation Roadmap'))).toBe(true);
      expect(titles.some((t) => t.includes('Digital Acceptance'))).toBe(true);

      // Verify deal updated
      const refreshed = await getEnterpriseDealById(d1, deal.id);
      expect(refreshed!.proposalContent).not.toBeNull();
      expect(refreshed!.dealStage).toBe('proposal_sent');
    });

    it('verifies Vietnamese proposal quality criteria (>= 1,200 words and 7 Vietnamese sections)', async () => {
      const deal = await createEnterpriseDeal(d1, {
        leadName: 'Nguyen Van An',
        leadEmail: 'an.nguyen@vietnam-content.vn',
        companyName: 'Vietnam Content Network',
        companyDomain: 'vietnam-content.vn',
        dealValueEstimateCents: 4800000,
        requestedMcuMonthly: 80000,
      });

      const result = await generateEnterpriseProposal(d1, deal.id, 'vi');
      expect(result.language).toBe('vi');
      expect(result.wordCount).toBeGreaterThanOrEqual(1200);
      expect(result.qualityPassed).toBe(true);
      expect(result.sections.length).toBeGreaterThanOrEqual(7);

      const titles = result.sections.map((s) => s.title);
      expect(titles.some((t) => t.includes('Tóm tắt điều hành'))).toBe(true);
      expect(titles.some((t) => t.includes('Mục tiêu chiến lược'))).toBe(true);
      expect(titles.some((t) => t.includes('Bản thiết kế kiến trúc'))).toBe(true);
      expect(titles.some((t) => t.includes('Cam kết SLA'))).toBe(true);
      expect(titles.some((t) => t.includes('Biểu phí'))).toBe(true);
      expect(titles.some((t) => t.includes('Lộ trình triển khai'))).toBe(true);
      expect(titles.some((t) => t.includes('Thỏa thuận pháp lý'))).toBe(true);
    });

    it('rejects incomplete proposals missing required sections', () => {
      const badMarkdown = '# Proposal\n## 1. Executive Summary\nShort summary.';
      const quality = verifyProposalQuality(badMarkdown, 'en');
      expect(quality.passed).toBe(false);
      expect(quality.wordCount).toBeLessThan(1200);
      expect(quality.missingSections.length).toBeGreaterThan(0);
    });
  });
});
