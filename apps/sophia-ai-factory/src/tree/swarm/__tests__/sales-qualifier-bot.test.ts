/** @vitest-environment node */

/**
 * Unit Test Suite: Autonomous Sales Qualifier Bot & B2B Inbound Triage
 *
 * Validates:
 * 1. Corporate email domain verification vs free/disposable filtering
 * 2. Deterministic BANT 4-factor scoring across diverse lead profiles
 * 3. Dynamic pipeline routing (hot, warm, cold) and automated qualification
 * 4. Executive bilingual proposal generation (EN & VI)
 * 5. Account executive meeting prep briefing generation
 * 6. Swarm node integration and telemetry tracking
 *
 * @module tree/swarm/__tests__/sales-qualifier-bot.test
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { createRequire } from 'node:module';
import type { D1Database } from '@/seed/db/client';
import { makeD1 } from '@/__tests__/integration/shared-d1-shim';
import {
  qualifyInboundLead,
  generateBilingualProposal,
  generateMeetingPrepBrief,
  processLeadWithSwarmNode,
} from '../sales-qualifier-bot';
import { registerSwarmNode, getSwarmNodeById } from '../swarm-coordinator';

const req = createRequire(import.meta.url);
const { DatabaseSync } = req('node:sqlite') as {
  DatabaseSync: new (path: string) => {
    exec(sql: string): void;
    prepare(sql: string): {
      get(...params: unknown[]): unknown;
      all(...params: unknown[]): unknown[];
      run(...params: unknown[]): { lastInsertRowid: bigint; changes: number };
    };
  };
};

describe('Autonomous Sales Qualifier Bot — Unit Tests', () => {
  let rawDb: InstanceType<typeof DatabaseSync>;
  let db: D1Database;

  beforeEach(() => {
    rawDb = new DatabaseSync(':memory:');
    rawDb.exec(`
      CREATE TABLE IF NOT EXISTS autonomous_swarm_nodes (
        id TEXT PRIMARY KEY,
        node_name TEXT NOT NULL,
        region TEXT NOT NULL,
        role TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'active',
        endpoint_url TEXT,
        last_heartbeat_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000),
        cpu_load_pct REAL NOT NULL DEFAULT 0.0,
        memory_load_pct REAL NOT NULL DEFAULT 0.0,
        active_tasks INTEGER NOT NULL DEFAULT 0,
        max_concurrency INTEGER NOT NULL DEFAULT 50,
        is_healthy INTEGER NOT NULL DEFAULT 1,
        capabilities_json TEXT NOT NULL DEFAULT '[]',
        metadata_json TEXT NOT NULL DEFAULT '{}',
        registered_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000),
        updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000)
      );
    `);
    db = makeD1(rawDb) as unknown as D1Database;
  });

  describe('BANT Lead Qualification & Funnel Classification', () => {
    it('qualifies high-value enterprise lead as hot with auto-qualification', () => {
      const result = qualifyInboundLead({
        leadName: 'Sarah Jenkins',
        leadEmail: 'sarah.jenkins@megacorp.io',
        leadTitle: 'Chief Marketing Officer',
        companyName: 'MegaCorp Global',
        companyDomain: 'megacorp.io',
        dealValueEstimateCents: 120_000_00, // $120,000 ARR
        requestedMcuMonthly: 300_000,
        timeframe: 'immediate',
        notes: 'Urgent: need dedicated GPU cluster, APAC dubbing in 5 languages, and YouTube Shorts syndication for global brand campaign',
      });

      expect(result.bantScore).toBeGreaterThanOrEqual(75);
      expect(result.pipelineTier).toBe('hot');
      expect(result.dealStage).toBe('qualified');
      expect(result.assignedAgentRole).toBe('ai_sales_executive');
      expect(result.autoQualified).toBe(true);
      expect(result.proposalContent).toBeDefined();
      expect(result.proposalContent).toContain('SOPHIA AI FACTORY — ENTERPRISE SOLUTION PROPOSAL');
      expect(result.proposalContent).toContain('BẢN ĐỀ XUẤT GIẢI PHÁP DOANH NGHIỆP TỰ TRỊ');
      expect(result.proposalContent).toContain('MegaCorp Global');
    });

    it('classifies mid-market lead as warm with enriching stage', () => {
      const result = qualifyInboundLead({
        leadName: 'David Lee',
        leadEmail: 'david@fintechgrowth.co',
        leadTitle: 'Growth Manager',
        companyName: 'Fintech Growth Co',
        companyDomain: 'fintechgrowth.co',
        dealValueEstimateCents: 36_000_00, // $36,000 ARR
        requestedMcuMonthly: 40_000,
        timeframe: '1_to_3_months',
        notes: 'Looking for video automation and template branding',
      });

      expect(result.bantScore).toBeGreaterThanOrEqual(50);
      expect(result.bantScore).toBeLessThan(75);
      expect(result.pipelineTier).toBe('warm');
      expect(result.dealStage).toBe('enriching');
      expect(result.autoQualified).toBe(false);
      expect(result.proposalContent).toBeDefined();
    });

    it('classifies low-intent disposable lead as cold', () => {
      const result = qualifyInboundLead({
        leadName: 'Test User',
        leadEmail: 'randomperson@gmail.com', // Free consumer email
        companyName: 'Unknown LLC',
        companyDomain: 'gmail.com',
        timeframe: 'exploring',
        notes: 'Just testing the waters',
      });

      expect(result.bantScore).toBeLessThan(50);
      expect(result.pipelineTier).toBe('cold');
      expect(result.dealStage).toBe('new_lead');
      expect(result.assignedAgentRole).toBe('unassigned');
      expect(result.autoQualified).toBe(false);
      expect(result.proposalContent).toBeUndefined(); // No proposal for cold leads
    });
  });

  describe('Executive Proposals & Meeting Briefs', () => {
    it('generates bilingual proposal containing both English and Vietnamese sections', () => {
      const proposal = generateBilingualProposal(
        {
          leadName: 'Minh Nguyen',
          leadEmail: 'minh@vietbrand.vn',
          leadTitle: 'VP Growth',
          companyName: 'VietBrand Group',
          companyDomain: 'vietbrand.vn',
          dealValueEstimateCents: 60_000_00,
          requestedMcuMonthly: 100_000,
        },
        88,
        'ENTERPRISE'
      );

      expect(proposal).toContain('VietBrand Group');
      expect(proposal).toContain('100,000 MCU');
      expect(proposal).toContain('99.999% Five-Nines Edge SLA');
      expect(proposal).toContain('cung cấp cỗ máy sản xuất video AI tự trị');
      expect(proposal).toContain('Minh Nguyen');
    });

    it('generates actionable meeting prep brief with key discovery questions', () => {
      const brief = generateMeetingPrepBrief(
        {
          leadName: 'Alex Mercer',
          leadEmail: 'alex@proto.com',
          companyName: 'Proto Systems',
          companyDomain: 'proto.com',
        },
        {
          bantScore: 82,
          pipelineTier: 'hot',
          scoringFactors: {
            budgetScore: 22,
            authorityScore: 20,
            needScore: 20,
            timelineScore: 20,
          },
        }
      );

      expect(brief).toContain('Proto Systems');
      expect(brief).toContain('Tier: HOT (82/100)');
      expect(brief).toContain('What is the current bottleneck');
      expect(brief).toContain('Key Discovery Questions:');
    });
  });

  describe('Swarm Node Telemetry Integration', () => {
    it('updates swarm node active tasks and heartbeat when lead is processed', async () => {
      const node = await registerSwarmNode(db, {
        id: 'node_sales_worker_01',
        nodeName: 'Sales Worker 01',
        region: 'apac',
        role: 'sales_qualifier',
      });

      const initialHeartbeat = node.lastHeartbeatAt;

      const result = await processLeadWithSwarmNode(
        db,
        {
          leadName: 'Kenji Sato',
          leadEmail: 'kenji@tokyo-media.jp',
          leadTitle: 'Head of Production',
          companyName: 'Tokyo Media Lab',
          companyDomain: 'tokyo-media.jp',
          dealValueEstimateCents: 50_000_00,
          requestedMcuMonthly: 80_000,
          notes: 'Japanese dubbing and TikTok shorts syndication',
        },
        'node_sales_worker_01'
      );

      expect(result.pipelineTier).toBe('hot');

      const updatedNode = await getSwarmNodeById(db, 'node_sales_worker_01');
      expect(updatedNode?.activeTasks).toBe(1);
      expect(updatedNode?.lastHeartbeatAt).toBeGreaterThanOrEqual(initialHeartbeat);
    });
  });
});
