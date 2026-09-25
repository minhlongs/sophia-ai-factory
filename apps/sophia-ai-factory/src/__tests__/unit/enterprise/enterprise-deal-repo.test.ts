/**
 * Unit Test Suite: Enterprise Deal Repository & D1 Data Access Object
 *
 * Validates:
 * 1. Deal creation with automatic BANT scoring & tier classification
 * 2. Lookup by ID and by company domain
 * 3. Filtered querying (stage, tier, search term, pagination)
 * 4. Deal mutations and stage transitions
 * 5. Deletion of deals
 * 6. Enrichment upsert and retrieval
 * 7. Aggregate pipeline metrics calculation
 *
 * @module __tests__/unit/enterprise/enterprise-deal-repo.test
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { createRequire } from 'node:module';
import { makeD1 } from '@/__tests__/integration/shared-d1-shim';
import {
  createEnterpriseDeal,
  getEnterpriseDealById,
  getEnterpriseDealByDomain,
  queryEnterpriseDeals,
  updateEnterpriseDeal,
  deleteEnterpriseDeal,
  upsertLeadEnrichment,
  getLeadEnrichmentByDomain,
  getDealsPipelineMetrics,
} from '@/tree/sales/enterprise-deal-repo';

const req = createRequire(import.meta.url);
const { DatabaseSync } = req('node:sqlite') as {
  DatabaseSync: new (path: string) => {
    exec(sql: string): void;
    prepare(sql: string): any;
  };
};

describe('Enterprise Deal Repository — Unit Tests', () => {
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

  describe('Deal Creation and Retrieval', () => {
    it('creates an enterprise deal and automatically evaluates BANT qualification', async () => {
      const deal = await createEnterpriseDeal(d1, {
        leadName: 'Le Hong Minh',
        leadEmail: 'minh.le@vng.com.vn',
        leadTitle: 'Chairman & CEO',
        companyName: 'VNG Corporation',
        companyDomain: 'vng.com.vn',
        dealValueEstimateCents: 12000000,
        requestedMcuMonthly: 300000,
        notes: 'High-volume APAC video dubbing',
        bantInput: {
          statedBudgetArr: 120000,
          statedMonthlyMcu: 300000,
          jobTitle: 'Chief Executive Officer',
          leadEmail: 'minh.le@vng.com.vn',
          needsApacDubbing: true,
          needsDedicatedGpuLane: true,
          timeframe: 'immediate',
        },
      });

      expect(deal.id).toBeDefined();
      expect(deal.companyName).toBe('VNG Corporation');
      expect(deal.pipelineTier).toBe('hot');
      expect(deal.bantScore).toBeGreaterThanOrEqual(80);
      expect(deal.dealStage).toBe('new_lead');

      const byId = await getEnterpriseDealById(d1, deal.id);
      expect(byId).not.toBeNull();
      expect(byId!.leadEmail).toBe('minh.le@vng.com.vn');

      const byDomain = await getEnterpriseDealByDomain(d1, 'vng.com.vn');
      expect(byDomain).not.toBeNull();
      expect(byDomain!.id).toBe(deal.id);
    });
  });

  describe('Filtered Queries and Search', () => {
    beforeEach(async () => {
      // Seed 3 deals with distinct attributes
      await createEnterpriseDeal(d1, {
        leadName: 'Alice CEO',
        leadEmail: 'alice@hotcorp.com',
        companyName: 'HotCorp Inc',
        companyDomain: 'hotcorp.com',
        dealValueEstimateCents: 10000000,
        dealStage: 'qualified',
        bantInput: { statedBudgetArr: 100000, jobTitle: 'CEO', timeframe: 'immediate' },
      });

      await createEnterpriseDeal(d1, {
        leadName: 'Bob Manager',
        leadEmail: 'bob@warmbrand.io',
        companyName: 'WarmBrand Media',
        companyDomain: 'warmbrand.io',
        dealValueEstimateCents: 3000000,
        dealStage: 'demo_active',
        bantInput: { statedBudgetArr: 30000, jobTitle: 'Marketing Manager', timeframe: '1_to_3_months' },
      });

      await createEnterpriseDeal(d1, {
        leadName: 'Charlie Contributor',
        leadEmail: 'charlie@gmail.com',
        companyName: 'ColdStudio',
        companyDomain: 'coldstudio.net',
        dealValueEstimateCents: 500000,
        dealStage: 'closed_won',
        bantInput: { statedBudgetArr: 5000, jobTitle: 'Specialist', timeframe: 'exploring' },
      });
    });

    it('queries deals by stage', async () => {
      const res = await queryEnterpriseDeals(d1, { stage: 'demo_active' });
      expect(res.deals.length).toBe(1);
      expect(res.deals[0].companyName).toBe('WarmBrand Media');
    });

    it('queries deals by pipeline tier', async () => {
      const res = await queryEnterpriseDeals(d1, { pipelineTier: 'hot' });
      expect(res.deals.length).toBe(1);
      expect(res.deals[0].companyName).toBe('HotCorp Inc');
    });

    it('searches deals by company name or domain keyword', async () => {
      const res = await queryEnterpriseDeals(d1, { search: 'warmbrand' });
      expect(res.deals.length).toBe(1);
      expect(res.deals[0].companyDomain).toBe('warmbrand.io');
    });

    it('supports pagination with limit and offset', async () => {
      const page1 = await queryEnterpriseDeals(d1, { limit: 2, offset: 0 });
      expect(page1.deals.length).toBe(2);
      expect(page1.total).toBe(3);
      expect(page1.hasMore).toBe(true);

      const page2 = await queryEnterpriseDeals(d1, { limit: 2, offset: 2 });
      expect(page2.deals.length).toBe(1);
      expect(page2.hasMore).toBe(false);
    });
  });

  describe('Deal Mutations & Deletion', () => {
    it('updates stage, proposal, and notes', async () => {
      const deal = await createEnterpriseDeal(d1, {
        leadName: 'David Founder',
        leadEmail: 'david@venture.vn',
        companyName: 'Venture Co',
        companyDomain: 'venture.vn',
      });

      const updated = await updateEnterpriseDeal(d1, deal.id, {
        dealStage: 'proposal_sent',
        proposalId: 'prop_test123',
        notes: 'Sent enterprise SLA proposal',
      });

      expect(updated.dealStage).toBe('proposal_sent');
      expect(updated.proposalId).toBe('prop_test123');
      expect(updated.notes).toBe('Sent enterprise SLA proposal');
    });

    it('deletes an enterprise deal', async () => {
      const deal = await createEnterpriseDeal(d1, {
        leadName: 'Eve Test',
        leadEmail: 'eve@test.com',
        companyName: 'Delete Me Co',
        companyDomain: 'deleteme.com',
      });

      const deleted = await deleteEnterpriseDeal(d1, deal.id);
      expect(deleted).toBe(true);

      const fetched = await getEnterpriseDealById(d1, deal.id);
      expect(fetched).toBeNull();
    });
  });

  describe('Lead Enrichment Upsert & Retrieval', () => {
    it('upserts and retrieves organizational enrichment', async () => {
      const enrichment = await upsertLeadEnrichment(d1, {
        dealId: null,
        domain: 'fintech-corp.com',
        companyName: 'Fintech Corp',
        industry: 'Financial Services',
        employeeCountRange: '200-500',
        estimatedAnnualRevenue: '$50M-$100M',
        headquartersLocation: 'Singapore',
        country: 'SG',
        techStack: ['PostgreSQL', 'Cloudflare', 'Kafka'],
        linkedinCompanyUrl: 'https://linkedin.com/company/fintech-corp',
        twitterHandle: '@fintechcorp',
        enrichmentSource: 'apollo',
        confidenceScore: 0.95,
        rawPayload: { verified: true },
        status: 'completed',
      });

      expect(enrichment.id).toBeDefined();
      expect(enrichment.domain).toBe('fintech-corp.com');
      expect(enrichment.techStack).toContain('Cloudflare');

      const retrieved = await getLeadEnrichmentByDomain(d1, 'fintech-corp.com');
      expect(retrieved).not.toBeNull();
      expect(retrieved!.companyName).toBe('Fintech Corp');
    });
  });

  describe('Pipeline Metrics Aggregation', () => {
    it('aggregates pipeline totals and BANT averages correctly', async () => {
      await createEnterpriseDeal(d1, {
        leadName: 'Lead 1',
        leadEmail: 'l1@a.com',
        companyName: 'A Corp',
        companyDomain: 'a.com',
        dealValueEstimateCents: 5000000,
        dealStage: 'closed_won',
        bantInput: { statedBudgetArr: 100000, jobTitle: 'CEO', timeframe: 'immediate' },
      });

      await createEnterpriseDeal(d1, {
        leadName: 'Lead 2',
        leadEmail: 'l2@b.com',
        companyName: 'B Corp',
        companyDomain: 'b.com',
        dealValueEstimateCents: 2000000,
        dealStage: 'negotiating',
        bantInput: { statedBudgetArr: 20000, jobTitle: 'Manager', timeframe: '3_to_6_months' },
      });

      const metrics = await getDealsPipelineMetrics(d1);
      expect(metrics.totalDeals).toBe(2);
      expect(metrics.wonDeals).toBe(1);
      expect(metrics.totalEstimatedValueCents).toBe(7000000);
      expect(metrics.avgBantScore).toBeGreaterThan(0);
    });
  });
});
