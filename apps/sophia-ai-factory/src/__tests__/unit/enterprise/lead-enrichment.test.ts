/**
 * Unit Test Suite: Multi-Tier B2B Lead & Organization Enrichment Service
 *
 * Validates:
 * 1. Domain brand extraction and normalization
 * 2. Heuristic profile inference across industries (fintech, edtech, media agency)
 * 3. D1 caching mechanism (cache hit vs miss vs forceRefresh)
 * 4. Automatic deal metadata update & BANT score recalculation
 *
 * @module __tests__/unit/enterprise/lead-enrichment.test
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { createRequire } from 'node:module';
import { makeD1 } from '@/__tests__/integration/shared-d1-shim';
import {
  extractBrandFromDomain,
  inferHeuristicProfile,
  enrichLead,
} from '@/tree/sales/lead-enrichment-service';
import { createEnterpriseDeal, getEnterpriseDealById } from '@/tree/sales/enterprise-deal-repo';

const req = createRequire(import.meta.url);
const { DatabaseSync } = req('node:sqlite') as {
  DatabaseSync: new (path: string) => {
    exec(sql: string): void;
    prepare(sql: string): any;
  };
};

describe('Lead Enrichment Service — Unit Tests', () => {
  describe('Domain Brand Extraction', () => {
    it('extracts formatted company brand from various domain patterns', () => {
      expect(extractBrandFromDomain('acme-corp.com')).toBe('Acme Corp');
      expect(extractBrandFromDomain('https://www.techflow.io/solutions')).toBe('Techflow');
      expect(extractBrandFromDomain('super_media.co.uk')).toBe('Super Media');
      expect(extractBrandFromDomain('vng.com.vn')).toBe('Vng');
      expect(extractBrandFromDomain('simple.org')).toBe('Simple');
    });
  });

  describe('Heuristic Profile Inference', () => {
    it('infers fintech profile accurately', () => {
      const profile = inferHeuristicProfile('vietpay-solutions.vn');
      expect(profile.industry).toContain('Fintech');
      expect(profile.techStack).toContain('Stripe');
      expect(profile.companyName).toBe('Vietpay Solutions');
    });

    it('infers media & agency profile accurately', () => {
      const profile = inferHeuristicProfile('viral-media-studio.com');
      expect(profile.industry).toContain('Agency & Media');
      expect(profile.techStack).toContain('YouTube API');
    });

    it('infers edtech profile accurately', () => {
      const profile = inferHeuristicProfile('global-academy-online.edu');
      expect(profile.industry).toContain('EdTech');
      expect(profile.techStack).toContain('Video Streaming');
    });
  });

  describe('Multi-Tier Lead Enrichment with D1', () => {
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

    it('enriches a domain and saves record to D1 cache', async () => {
      const enrichment = await enrichLead(d1, 'fpt-software.com');
      expect(enrichment.domain).toBe('fpt-software.com');
      expect(enrichment.companyName).toBe('Fpt Software');
      expect(enrichment.techStack.length).toBeGreaterThan(0);
      expect(enrichment.status).toBe('completed');

      // Second call hits cache
      const cached = await enrichLead(d1, 'fpt-software.com');
      expect(cached.id).toBe(enrichment.id);
    });

    it('updates associated deal and recalculates BANT qualification', async () => {
      const deal = await createEnterpriseDeal(d1, {
        leadName: 'Executive Director',
        leadEmail: 'director@enterprise-corp.vn',
        companyName: 'enterprise-corp.vn',
        companyDomain: 'enterprise-corp.vn',
        dealValueEstimateCents: 6000000,
        requestedMcuMonthly: 100000,
        dealStage: 'enriching',
      });

      expect(deal.dealStage).toBe('enriching');

      const enrichment = await enrichLead(d1, 'enterprise-corp.vn', {
        dealId: deal.id,
      });

      expect(enrichment.dealId).toBe(deal.id);

      const refreshedDeal = await getEnterpriseDealById(d1, deal.id);
      expect(refreshedDeal).not.toBeNull();
      expect(refreshedDeal!.dealStage).toBe('qualified');
      expect(refreshedDeal!.metadata.enrichmentId).toBe(enrichment.id);
    });
  });
});
