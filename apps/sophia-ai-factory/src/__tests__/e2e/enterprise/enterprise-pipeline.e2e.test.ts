/**
 * Enterprise Sales Pipeline E2E Test Suite (Tiers 1–4)
 *
 * Implements opaque-box, requirement-driven E2E verification of:
 * 1. BANT 4-Factor Scoring Engine (Budget, Authority, Need, Timeline)
 * 2. Multi-tier B2B Organization & Domain Enrichment
 * 3. Hot/Warm/Cold CRM Funnel Classification & Deal Stage State Machine
 * 4. Bilingual VI/EN Solution Proposal Generation & Quality Certification
 * 5. 1-Click Sandboxed Demo Workspace Provisioning & HMAC-SHA256 Magic Token Security
 * 6. Admin Deals Portal Data Access & Pipeline Metrics Aggregation
 *
 * @vitest-environment node
 * @module __tests__/e2e/enterprise/enterprise-pipeline.e2e.test
 */

import { describe, it, expect, beforeEach } from 'vitest';
import type { D1Database } from '@cloudflare/workers-types';
import { createEnterpriseTestDb } from './enterprise-e2e-harness';
import {
  calculateBantScore,
  isCorporateEmailDomain,
} from '@/tree/sales/bant-scoring-service';
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
import {
  enrichLead,
  extractBrandFromDomain,
  inferHeuristicProfile,
} from '@/tree/sales/lead-enrichment-service';
import {
  generateEnterpriseProposal,
  verifyProposalQuality,
  countWords,
} from '@/tree/sales/enterprise-proposal-service';
import {
  provisionDemoSandbox,
  generateSandboxToken,
  verifySandboxToken,
  signHmacSha256,
} from '@/tree/sales/sandbox-provisioner';
import { generateMeetingPrepDossier } from '@/tree/sales/meeting-prep-service';
import type {
  CreateEnterpriseDealInput,
  BantScoreInput,
  ProposalLanguage,
} from '@/seed/types/enterprise-deal';

describe('Enterprise Sales Pipeline E2E Suite (Tiers 1–4)', () => {
  let d1: D1Database;
  let seedDefaults: () => Promise<void>;

  beforeEach(async () => {
    const harness = createEnterpriseTestDb();
    d1 = harness.d1;
    seedDefaults = harness.seedDefaults;
    await seedDefaults();
  });

  // ==========================================================================
  // TIER 1: FEATURE COVERAGE (>=5 tests per feature)
  // ==========================================================================

  describe('Tier 1: Feature Coverage', () => {
    describe('Feature 1: BANT 4-Factor Scoring Engine', () => {
      it('F1-1: scores maximum 25 for large enterprise budget (>= $100K ARR or >= 250K MCU)', () => {
        const input: BantScoreInput = {
          leadEmail: 'vp@enterprisecorp.com',
          statedBudgetArr: 150_000,
          statedMonthlyMcu: 300_000,
        };
        const result = calculateBantScore(input);
        expect(result.budgetScore).toBe(25);
      });

      it('F1-2: scores maximum 25 for C-Level authority with corporate email domain', () => {
        const input: BantScoreInput = {
          leadEmail: 'cto@innovate.vn',
          jobTitle: 'Chief Technology Officer (CTO)',
        };
        const result = calculateBantScore(input);
        expect(result.authorityScore).toBe(25);
      });

      it('F1-3: scores maximum 25 for high technical need (APAC dubbing + dedicated GPU lane + syndication + custom API)', () => {
        const input: BantScoreInput = {
          leadEmail: 'media@studios.apac',
          needsApacDubbing: true,
          needsDedicatedGpuLane: true,
          needsHighVolumeSyndication: true,
          needsCustomApiOrWhiteLabel: true,
          statedBottleneckOrPainPoint: 'Need to automate 50,000 localized video reels monthly',
        };
        const result = calculateBantScore(input);
        expect(result.needScore).toBe(25);
      });

      it('F1-4: scores maximum 25 for immediate/ASAP deployment timeframe', () => {
        const input: BantScoreInput = {
          leadEmail: 'ops@growth.io',
          timeframe: 'immediate',
        };
        const result = calculateBantScore(input);
        expect(result.timelineScore).toBe(25);
      });

      it('F1-5: computes full BANT evaluation yielding 100/100 and classifies as "hot"', () => {
        const input: BantScoreInput = {
          leadEmail: 'ceo@megacorp.com',
          jobTitle: 'Chief Executive Officer',
          statedBudgetArr: 200_000,
          statedMonthlyMcu: 500_000,
          needsApacDubbing: true,
          needsDedicatedGpuLane: true,
          needsHighVolumeSyndication: true,
          needsCustomApiOrWhiteLabel: true,
          statedBottleneckOrPainPoint: 'Need to automate 50,000 localized video reels monthly',
          timeframe: 'immediate',
        };
        const result = calculateBantScore(input);
        expect(result.totalScore).toBe(100);
        expect(result.pipelineTier).toBe('hot');
        expect(result.analysis.recommendation).toContain('Immediate executive outreach');
      });
    });

    describe('Feature 2: B2B Organization & Domain Enrichment', () => {
      it('F2-1: extracts clean, capitalized brand name from various domain patterns', () => {
        expect(extractBrandFromDomain('techflow.io')).toBe('Techflow');
        expect(extractBrandFromDomain('https://www.vinagroup.com.vn/about')).toBe('Vinagroup');
        expect(extractBrandFromDomain('apac-media-hub.net')).toBe('Apac Media Hub');
      });

      it('F2-2: infers heuristic profile with industry and modern enterprise tech stack', () => {
        const profile = inferHeuristicProfile('tokyo-creative-studio.jp');
        expect(profile.companyName).toBe('Tokyo Creative Studio');
        expect(profile.industry).toContain('Media');
        expect(profile.techStack).toBeInstanceOf(Array);
        expect(profile.techStack.length).toBeGreaterThan(0);
      });

      it('F2-3: persists lead enrichment into D1 and retrieves by domain', async () => {
        const enrichment = await upsertLeadEnrichment(d1, {
          domain: 'vinacorp.vn',
          dealId: null,
          companyName: 'Vina Corp Enterprise',
          industry: 'Telecommunications & Media',
          employeeCountRange: '500-1000',
          estimatedAnnualRevenue: '$50M-$100M',
          headquartersLocation: 'Hanoi, Vietnam',
          country: 'Vietnam',
          techStack: ['Next.js', 'Cloudflare Workers', 'ElevenLabs', 'Whisper'],
          linkedinCompanyUrl: null,
          twitterHandle: null,
          confidenceScore: 0.95,
          enrichmentSource: 'heuristic',
          rawPayload: {},
          status: 'completed',
        });

        expect(enrichment.id).toBeDefined();
        expect(enrichment.domain).toBe('vinacorp.vn');

        const fetched = await getLeadEnrichmentByDomain(d1, 'vinacorp.vn');
        expect(fetched).not.toBeNull();
        expect(fetched?.companyName).toBe('Vina Corp Enterprise');
        expect(fetched?.confidenceScore).toBe(0.95);
      });

      it('F2-4: reuses fresh cached enrichment within 30 days without redundant fetching', async () => {
        await upsertLeadEnrichment(d1, {
          domain: 'cached-enterprise.com',
          dealId: null,
          companyName: 'Cached Enterprise Inc',
          industry: 'FinTech',
          employeeCountRange: null,
          estimatedAnnualRevenue: null,
          headquartersLocation: null,
          country: null,
          techStack: [],
          linkedinCompanyUrl: null,
          twitterHandle: null,
          confidenceScore: 0.99,
          enrichmentSource: 'clearbit',
          rawPayload: {},
          status: 'completed',
        });

        const enriched = await enrichLead(d1, 'cached-enterprise.com');
        expect(enriched.enrichmentSource).toBe('clearbit');
        expect(enriched.companyName).toBe('Cached Enterprise Inc');
      });

      it('F2-5: auto-enriches and associates profile with an existing deal record', async () => {
        const deal = await createEnterpriseDeal(d1, {
          leadName: 'Nguyen Van A',
          leadEmail: 'nva@vietretail.vn',
          companyName: 'Viet Retail Group',
          companyDomain: 'vietretail.vn',
          dealStage: 'enriching',
        });

        const enriched = await enrichLead(d1, 'vietretail.vn', { dealId: deal.id });
        expect(enriched.dealId).toBe(deal.id);

        const updatedDeal = await getEnterpriseDealById(d1, deal.id);
        expect(updatedDeal?.dealStage).toBe('qualified');
      });
    });

    describe('Feature 3: Hot/Warm/Cold CRM Funnel & Metrics', () => {
      it('F3-1: classifies deal as "hot" when BANT score >= 75', async () => {
        const deal = await createEnterpriseDeal(d1, {
          leadName: 'Alex Mercer',
          leadEmail: 'alex@apexholdings.com',
          leadTitle: 'Chief Technology Officer',
          companyName: 'Apex Holdings',
          companyDomain: 'apexholdings.com',
          requestedMcuMonthly: 300_000,
          bantInput: {
            statedBudgetArr: 120_000,
            timeframe: 'immediate',
            needsDedicatedGpuLane: true,
            needsApacDubbing: true,
          },
        });

        expect(deal.bantScore).toBeGreaterThanOrEqual(75);
        expect(deal.pipelineTier).toBe('hot');
      });

      it('F3-2: classifies deal as "warm" when BANT score is between 50 and 74', async () => {
        const deal = await createEnterpriseDeal(d1, {
          leadName: 'Sara Connor',
          leadEmail: 'sara@midcorp.io',
          leadTitle: 'VP of Engineering',
          companyName: 'MidCorp IO',
          companyDomain: 'midcorp.io',
          requestedMcuMonthly: 100_000,
          bantInput: {
            statedBudgetArr: 30_000,
            timeframe: 'quarter',
            needsApacDubbing: true,
            needsHighVolumeSyndication: true,
          },
        });

        expect(deal.bantScore).toBeGreaterThanOrEqual(50);
        expect(deal.bantScore).toBeLessThan(75);
        expect(deal.pipelineTier).toBe('warm');
      });

      it('F3-3: classifies deal as "cold" when BANT score is below 50', async () => {
        const deal = await createEnterpriseDeal(d1, {
          leadName: 'John Doe',
          leadEmail: 'johndoe@gmail.com',
          companyName: 'Unknown Hobby',
          companyDomain: 'gmail.com',
          bantInput: {
            timeframe: 'curious',
          },
        });

        expect(deal.bantScore).toBeLessThan(50);
        expect(deal.pipelineTier).toBe('cold');
      });

      it('F3-4: supports linear stage progression across the entire enterprise sales lifecycle', async () => {
        const deal = await createEnterpriseDeal(d1, {
          leadName: 'Sarah Jenkins',
          leadEmail: 'sarah@globalstream.net',
          companyName: 'Global Stream Network',
          companyDomain: 'globalstream.net',
        });

        expect(deal.dealStage).toBe('new_lead');

        const stages = [
          'enriching',
          'qualified',
          'demo_prepared',
          'demo_active',
          'proposal_sent',
          'negotiating',
          'closed_won',
        ] as const;

        for (const nextStage of stages) {
          const updated = await updateEnterpriseDeal(d1, deal.id, { dealStage: nextStage });
          expect(updated?.dealStage).toBe(nextStage);
        }
      });

      it('F3-5: aggregates pipeline metrics across tiers, stages, and total deal values', async () => {
        await createEnterpriseDeal(d1, {
          leadName: 'Hot Lead 1',
          leadEmail: 'hot1@corp.com',
          companyName: 'Corp 1',
          companyDomain: 'corp1.com',
          dealValueEstimateCents: 10_000_000,
          bantInput: { statedBudgetArr: 100_000, timeframe: 'immediate', jobTitle: 'CTO' },
        });

        await createEnterpriseDeal(d1, {
          leadName: 'Cold Lead 1',
          leadEmail: 'cold1@gmail.com',
          companyName: 'Hobby 1',
          companyDomain: 'gmail.com',
          dealValueEstimateCents: 1_000_000,
          bantInput: { timeframe: 'curious' },
        });

        const metrics = await getDealsPipelineMetrics(d1);
        expect(metrics.totalDeals).toBeGreaterThanOrEqual(2);
        expect(metrics.totalEstimatedValueCents).toBeGreaterThanOrEqual(11_000_000);
        expect(metrics.hotDeals).toBeGreaterThanOrEqual(1);
        expect(metrics.coldDeals).toBeGreaterThanOrEqual(1);
      });
    });

    describe('Feature 4: Bilingual VI/EN Solution Proposals', () => {
      it('F4-1: generates comprehensive English proposal with >= 1,200 words', async () => {
        const deal = await createEnterpriseDeal(d1, {
          leadName: 'David Zhang',
          leadEmail: 'david@apacmedia.sg',
          companyName: 'APAC Media Global',
          companyDomain: 'apacmedia.sg',
          requestedMcuMonthly: 250_000,
        });

        const proposal = await generateEnterpriseProposal(d1, deal.id, 'en');
        expect(proposal.language).toBe('en');
        expect(proposal.wordCount).toBeGreaterThanOrEqual(1200);
        expect(proposal.qualityPassed).toBe(true);
      });

      it('F4-2: verifies all 7 mandatory sections in English proposal', async () => {
        const deal = await createEnterpriseDeal(d1, {
          leadName: 'Evelyn Reed',
          leadEmail: 'evelyn@reedmedia.com',
          companyName: 'Reed Media International',
          companyDomain: 'reedmedia.com',
          requestedMcuMonthly: 150_000,
        });

        const proposal = await generateEnterpriseProposal(d1, deal.id, 'en');
        const mandatorySections = [
          'Executive Summary',
          'Strategic Objectives & Bottlenecks',
          'Sophia AI Factory Architecture Blueprint',
          'SLA Commitments (99.9% Uptime) & Security Compliance',
          'Commercial Terms & Volume Discounts',
          'Implementation Roadmap & Key Milestones',
          'Digital Acceptance & Authorization',
        ];

        for (const section of mandatorySections) {
          expect(proposal.fullMarkdown.toLowerCase()).toContain(section.toLowerCase());
        }
      });

      it('F4-3: generates comprehensive Vietnamese proposal with >= 1,200 words', async () => {
        const deal = await createEnterpriseDeal(d1, {
          leadName: 'Le Hoang Nam',
          leadEmail: 'nam@vinamedia.vn',
          companyName: 'Vina Media Conglomerate',
          companyDomain: 'vinamedia.vn',
          requestedMcuMonthly: 200_000,
        });

        const proposal = await generateEnterpriseProposal(d1, deal.id, 'vi');
        expect(proposal.language).toBe('vi');
        expect(proposal.wordCount).toBeGreaterThanOrEqual(1200);
        expect(proposal.qualityPassed).toBe(true);
      });

      it('F4-4: verifies all 7 mandatory Vietnamese sections', async () => {
        const deal = await createEnterpriseDeal(d1, {
          leadName: 'Tran Thi Mai',
          leadEmail: 'mai@saigonbroadcast.vn',
          companyName: 'Saigon Broadcasting Network',
          companyDomain: 'saigonbroadcast.vn',
          requestedMcuMonthly: 100_000,
        });

        const proposal = await generateEnterpriseProposal(d1, deal.id, 'vi');
        const mandatorySectionsVi = [
          'Tóm tắt điều hành',
          'Mục tiêu chiến lược & Thách thức vận hành',
          'Bản thiết kế kiến trúc Sophia AI Factory',
          'Cam kết SLA (99.9% Uptime) & An toàn thông tin',
          'Biểu phí & Chiết khấu khối lượng doanh nghiệp',
          'Lộ trình triển khai & Các cột mốc chính',
          'Thỏa thuận pháp lý & Chữ ký số xác nhận',
        ];

        for (const section of mandatorySectionsVi) {
          expect(proposal.fullMarkdown.toLowerCase()).toContain(section.toLowerCase());
        }
      });

      it('F4-5: rejects truncated or incomplete proposals through quality gate', () => {
        const shortProposal = `# Incomplete Proposal\n## 1. Executive Summary\nShort text.`;
        const quality = verifyProposalQuality(shortProposal, 'en');
        expect(quality.passed).toBe(false);
        expect(quality.wordCount).toBeLessThan(1200);
        expect(quality.missingSections.length).toBeGreaterThan(0);
      });
    });

    describe('Feature 5: 1-Click Sandboxed Demo Workspace', () => {
      it('F5-1: provisions an isolated client subaccount in D1', async () => {
        const deal = await createEnterpriseDeal(d1, {
          leadName: 'Kenji Sato',
          leadEmail: 'kenji@tokyovideo.jp',
          companyName: 'Tokyo Video Works',
          companyDomain: 'tokyovideo.jp',
        });

        const result = await provisionDemoSandbox(d1, deal.id);
        expect(result.subaccountId).toBeDefined();

        const dealAfter = await getEnterpriseDealById(d1, deal.id);
        expect(dealAfter?.sandboxSubaccountId).toBe(result.subaccountId);
        expect(dealAfter?.sandboxStatus).toBe('active');
        expect(dealAfter?.dealStage).toBe('demo_active');
      });

      it('F5-2: credits exactly 1,000 demo MCUs to the sandboxed subaccount', async () => {
        const deal = await createEnterpriseDeal(d1, {
          leadName: 'Park Min Woo',
          leadEmail: 'minwoo@seoulmedia.kr',
          companyName: 'Seoul Media Labs',
          companyDomain: 'seoulmedia.kr',
        });

        const result = await provisionDemoSandbox(d1, deal.id);
        expect(result.allocatedMcu).toBe(1000);

        const row = await d1
          .prepare('SELECT * FROM subaccount_mcu_allocations WHERE subaccount_id = ?')
          .bind(result.subaccountId)
          .first<{ allocated_mcu: number; used_mcu: number }>();

        expect(row?.allocated_mcu).toBe(1000);
        expect(row?.used_mcu).toBe(0);
      });

      it('F5-3: generates cryptographically valid HMAC-SHA256 demo magic access token', async () => {
        const payload = {
          dealId: 'deal_ent_test_99',
          subaccountId: 'sub_ent_test_99',
          expiresAt: Date.now() + 14 * 24 * 60 * 60 * 1000,
        };
        const token = await generateSandboxToken(payload, 'enterprise-hmac-secret-test');
        expect(token).toContain('.');

        const verification = await verifySandboxToken(token, 'enterprise-hmac-secret-test');
        expect(verification.valid).toBe(true);
        expect(verification.payload?.dealId).toBe('deal_ent_test_99');
      });

      it('F5-4: verifies access token expiration policy (14 days by default)', async () => {
        const deal = await createEnterpriseDeal(d1, {
          leadName: 'Alice Wong',
          leadEmail: 'alice@hongkongdigital.hk',
          companyName: 'Hong Kong Digital',
          companyDomain: 'hongkongdigital.hk',
        });

        const result = await provisionDemoSandbox(d1, deal.id, { expiryDays: 14 });
        const now = Date.now();
        const expectedExpiryMin = now + 13 * 24 * 60 * 60 * 1000;
        const expectedExpiryMax = now + 15 * 24 * 60 * 60 * 1000;

        expect(result.expiresAt).toBeGreaterThan(expectedExpiryMin);
        expect(result.expiresAt).toBeLessThan(expectedExpiryMax);
      });

      it('F5-5: generates ready-to-share magic access URL with branded watermark policy', async () => {
        const deal = await createEnterpriseDeal(d1, {
          leadName: 'Somchai Prasert',
          leadEmail: 'somchai@bangkokagency.th',
          companyName: 'Bangkok Creative Agency',
          companyDomain: 'bangkokagency.th',
        });

        const result = await provisionDemoSandbox(d1, deal.id);
        expect(result.demoMagicUrl).toContain('/sandbox/');
        expect(result.demoMagicUrl).toContain(result.sandboxToken);
      });
    });

    describe('Feature 6: Admin Deals Portal & Actions', () => {
      it('F6-1: creates enterprise deal with complete fields and metadata', async () => {
        const deal = await createEnterpriseDeal(d1, {
          leadName: 'Robert Vance',
          leadEmail: 'bob@vancerefrigeration.com',
          leadPhone: '+1-555-0199',
          leadTitle: 'CEO',
          companyName: 'Vance Refrigeration',
          companyDomain: 'vancerefrigeration.com',
          leadSource: 'referral',
          dealValueEstimateCents: 5_000_000,
          currency: 'USD',
          requestedMcuMonthly: 100_000,
          notes: 'Interested in APAC expansion for automated cooling systems video ads.',
        });

        expect(deal.id).toBeDefined();
        expect(deal.companyName).toBe('Vance Refrigeration');
        expect(deal.leadSource).toBe('referral');
      });

      it('F6-2: filters deals by pipeline stage and pipeline tier', async () => {
        await createEnterpriseDeal(d1, {
          leadName: 'Lead A',
          leadEmail: 'a@corp.com',
          companyName: 'Corp A',
          companyDomain: 'corpa.com',
          bantInput: { statedBudgetArr: 100_000, timeframe: 'immediate', jobTitle: 'CTO' },
        });

        await createEnterpriseDeal(d1, {
          leadName: 'Lead B',
          leadEmail: 'b@gmail.com',
          companyName: 'Corp B',
          companyDomain: 'corpb.com',
          bantInput: { timeframe: 'curious' },
        });

        const hotResult = await queryEnterpriseDeals(d1, { pipelineTier: 'hot' });
        expect(hotResult.deals.every((d) => d.pipelineTier === 'hot')).toBe(true);

        const coldResult = await queryEnterpriseDeals(d1, { pipelineTier: 'cold' });
        expect(coldResult.deals.every((d) => d.pipelineTier === 'cold')).toBe(true);
      });

      it('F6-3: searches deals by company name or domain keyword', async () => {
        await createEnterpriseDeal(d1, {
          leadName: 'Search Target',
          leadEmail: 'target@uniquedomain123.com',
          companyName: 'Unique Search Company Inc',
          companyDomain: 'uniquedomain123.com',
        });

        const searchResult = await queryEnterpriseDeals(d1, { search: 'Unique Search' });
        expect(searchResult.deals.length).toBeGreaterThanOrEqual(1);
        expect(searchResult.deals[0].companyDomain).toBe('uniquedomain123.com');
      });

      it('F6-4: updates deal notes, estimate, and custom metadata safely', async () => {
        const deal = await createEnterpriseDeal(d1, {
          leadName: 'Updatable Lead',
          leadEmail: 'update@test.com',
          companyName: 'Update Corp',
          companyDomain: 'updatecorp.com',
        });

        const updated = await updateEnterpriseDeal(d1, deal.id, {
          notes: 'Updated notes after executive discovery call',
          dealValueEstimateCents: 25_000_000,
          metadata: { priorityReview: true, executiveSponsor: 'VP Sales' },
        });

        expect(updated?.notes).toBe('Updated notes after executive discovery call');
        expect(updated?.dealValueEstimateCents).toBe(25_000_000);
      });

      it('F6-5: deletes deal and handles cascading cleanup', async () => {
        const deal = await createEnterpriseDeal(d1, {
          leadName: 'Deletable Lead',
          leadEmail: 'delete@test.com',
          companyName: 'Delete Corp',
          companyDomain: 'deletecorp.com',
        });

        const deleted = await deleteEnterpriseDeal(d1, deal.id);
        expect(deleted).toBe(true);

        const check = await getEnterpriseDealById(d1, deal.id);
        expect(check).toBeNull();
      });
    });
  });

  // ==========================================================================
  // TIER 2: BOUNDARY & CORNER CASES (>=5 tests)
  // ==========================================================================

  describe('Tier 2: Boundary & Corner Cases', () => {
    it('B1: handles empty/whitespace strings gracefully in deal creation and sanitizes inputs', async () => {
      const deal = await createEnterpriseDeal(d1, {
        leadName: '   Whitespace Lead   ',
        leadEmail: '   clean@domain.com   ',
        companyName: '   Trimmed Company   ',
        companyDomain: '   TrimmedDomain.com   ',
      });

      expect(deal.leadName).toBe('Whitespace Lead');
      expect(deal.leadEmail).toBe('clean@domain.com');
      expect(deal.companyDomain).toBe('trimmeddomain.com');
    });

    it('B2: handles malformed or public webmail email domains in corporate email detector', () => {
      expect(isCorporateEmailDomain('user@gmail.com')).toBe(false);
      expect(isCorporateEmailDomain('user@yahoo.com')).toBe(false);
      expect(isCorporateEmailDomain('user@hotmail.com')).toBe(false);
      expect(isCorporateEmailDomain('invalid-email-no-at')).toBe(false);
      expect(isCorporateEmailDomain('user@')).toBe(false);
      expect(isCorporateEmailDomain('user@company.enterprise.com')).toBe(true);
    });

    it('B3: rejects expired sandbox tokens deterministically', async () => {
      const expiredPayload = {
        dealId: 'deal_expired_test',
        subaccountId: 'sub_expired_test',
        expiresAt: Date.now() - 5000,
      };
      const token = await generateSandboxToken(expiredPayload, 'secret-123');
      const result = await verifySandboxToken(token, 'secret-123');

      expect(result.valid).toBe(false);
      expect(result.expired).toBe(true);
    });

    it('B4: rejects tampered sandbox tokens with corrupted signatures', async () => {
      const validPayload = {
        dealId: 'deal_legit',
        subaccountId: 'sub_legit',
        expiresAt: Date.now() + 100_000,
      };
      const token = await generateSandboxToken(validPayload, 'secret-123');
      const [payloadPart, sigPart] = token.split('.');

      const corruptedSig = sigPart.slice(0, -1) + (sigPart.slice(-1) === 'a' ? 'b' : 'a');
      const tamperedToken = `${payloadPart}.${corruptedSig}`;

      const result = await verifySandboxToken(tamperedToken, 'secret-123');
      expect(result.valid).toBe(false);
    });

    it('B5: handles extreme requested MCU boundaries (0, negative, and 10M MCU)', () => {
      const zeroMcu = calculateBantScore({ leadEmail: 'test@corp.com', statedMonthlyMcu: 0 });
      expect(zeroMcu.budgetScore).toBeGreaterThanOrEqual(0);

      const negativeMcu = calculateBantScore({ leadEmail: 'test@corp.com', statedMonthlyMcu: -50000 });
      expect(negativeMcu.budgetScore).toBeGreaterThanOrEqual(0);

      const extremeMcu = calculateBantScore({ leadEmail: 'test@corp.com', statedMonthlyMcu: 10_000_000 });
      expect(extremeMcu.budgetScore).toBe(25);
    });

    it('B6: defaults gracefully to English for unrecognized proposal language inputs', async () => {
      const deal = await createEnterpriseDeal(d1, {
        leadName: 'Fallback Tester',
        leadEmail: 'tester@fallback.com',
        companyName: 'Fallback Org',
        companyDomain: 'fallback.com',
      });

      const proposal = await generateEnterpriseProposal(d1, deal.id, 'fr' as unknown as ProposalLanguage);
      expect(proposal.qualityPassed).toBe(true);
      expect(proposal.fullMarkdown).toContain('Executive Summary');
    });
  });

  // ==========================================================================
  // TIER 3: CROSS-FEATURE COMBINATIONS
  // ==========================================================================

  describe('Tier 3: Cross-Feature Combinations', () => {
    it('C1: full lead journey: Ingestion -> BANT Scoring -> Auto-Enrichment -> Qualified Deal', async () => {
      // 1. Ingest Inbound Deal
      const deal = await createEnterpriseDeal(d1, {
        leadName: 'Kenichi Takahashi',
        leadEmail: 'takahashi@tokyomedia.co.jp',
        leadTitle: 'VP of Digital Production',
        companyName: 'Tokyo Media Holdings',
        companyDomain: 'tokyomedia.co.jp',
        requestedMcuMonthly: 250_000,
        dealValueEstimateCents: 15_000_000,
        dealStage: 'enriching',
        bantInput: {
          statedBudgetArr: 150_000,
          needsApacDubbing: true,
          needsDedicatedGpuLane: true,
          timeframe: 'immediate',
        },
      });

      expect(deal.pipelineTier).toBe('hot');
      expect(deal.bantScore).toBeGreaterThanOrEqual(80);

      // 2. Multi-tier Lead Enrichment
      const enriched = await enrichLead(d1, deal.companyDomain, { dealId: deal.id });
      expect(enriched.dealId).toBe(deal.id);
      expect(enriched.companyName).toContain('Tokyomedia');

      // 3. Verify deal reached qualified state
      const verifiedDeal = await getEnterpriseDealById(d1, deal.id);
      expect(verifiedDeal?.dealStage).toBe('qualified');
    });

    it('C2: qualified deal -> meeting prep briefing -> bilingual proposal generation', async () => {
      const deal = await createEnterpriseDeal(d1, {
        leadName: 'Bao Nguyen',
        leadEmail: 'bao@vinastream.vn',
        leadTitle: 'Chief Technology Officer',
        companyName: 'Vina Stream Interactive',
        companyDomain: 'vinastream.vn',
        requestedMcuMonthly: 200_000,
      });

      // 1. Generate Executive Meeting Prep
      const dossier = await generateMeetingPrepDossier(d1, deal.id);
      expect(dossier.battlecards.length).toBeGreaterThan(0);
      expect(dossier.fullBriefMarkdown).toBeDefined();

      // 2. Generate Vietnamese Proposal
      const proposalVi = await generateEnterpriseProposal(d1, deal.id, 'vi');
      expect(proposalVi.qualityPassed).toBe(true);
      expect(proposalVi.wordCount).toBeGreaterThanOrEqual(1200);

      // 3. Verify deal links proposal ID and proposal content
      const updatedDeal = await getEnterpriseDealById(d1, deal.id);
      expect(updatedDeal?.proposalId).toBe(proposalVi.proposalId);
      expect(updatedDeal?.proposalLanguage).toBe('vi');
      expect(updatedDeal?.dealStage).toBe('proposal_sent');
    });

    it('C3: qualified deal -> sandboxed demo provisioning -> magic access verification -> active demo', async () => {
      const deal = await createEnterpriseDeal(d1, {
        leadName: 'Marcus Aurelius',
        leadEmail: 'marcus@romanmedia.it',
        companyName: 'Roman Media Enterprise',
        companyDomain: 'romanmedia.it',
      });

      // 1. Provision 1-click sandbox
      const sandbox = await provisionDemoSandbox(d1, deal.id);
      expect(sandbox.subaccountId).toBeDefined();
      expect(sandbox.sandboxToken).toBeDefined();

      // 2. Validate magic token cryptographic access
      const tokenVerification = await verifySandboxToken(sandbox.sandboxToken);
      expect(tokenVerification.valid).toBe(true);
      expect(tokenVerification.payload?.dealId).toBe(deal.id);
      expect(tokenVerification.payload?.subaccountId).toBe(sandbox.subaccountId);

      // 3. Confirm Deal transitioned to demo_active
      const updated = await getEnterpriseDealById(d1, deal.id);
      expect(updated?.dealStage).toBe('demo_active');
      expect(updated?.sandboxToken).toBe(sandbox.sandboxToken);
      expect(updated?.sandboxStatus).toBe('active');
    });
  });

  // ==========================================================================
  // TIER 4: REAL-WORLD APPLICATION SCENARIOS
  // ==========================================================================

  describe('Tier 4: Real-World Enterprise Sales Scenarios', () => {
    it('S1: APAC Multi-National Media Group ("AsiaMedia Corp") complete inbound-to-demo journey', async () => {
      // Step 1: Inbound submission via landing page
      const deal = await createEnterpriseDeal(d1, {
        leadName: 'Chen Wei',
        leadEmail: 'chen.wei@asiamedia.com.sg',
        leadPhone: '+65-6888-0000',
        leadTitle: 'Chief Technology Officer (CTO)',
        companyName: 'AsiaMedia Corporation Pte Ltd',
        companyDomain: 'asiamedia.com.sg',
        leadSource: 'website',
        requestedMcuMonthly: 500_000,
        dealValueEstimateCents: 35_000_000,
        currency: 'USD',
        notes: 'Urgent requirement to syndicate 50,000 video shorts monthly to TikTok and YouTube across APAC.',
        bantInput: {
          statedBudgetArr: 350_000,
          statedMonthlyMcu: 500_000,
          needsApacDubbing: true,
          needsDedicatedGpuLane: true,
          needsHighVolumeSyndication: true,
          needsCustomApiOrWhiteLabel: true,
          statedBottleneckOrPainPoint: 'Urgent requirement to syndicate 50,000 video shorts monthly to TikTok and YouTube across APAC.',
          timeframe: 'immediate',
        },
      });

      expect(deal.bantScore).toBe(100);
      expect(deal.pipelineTier).toBe('hot');

      // Step 2: Automatic organization enrichment
      const enriched = await enrichLead(d1, deal.companyDomain, { dealId: deal.id });
      expect(enriched.domain).toBe('asiamedia.com.sg');

      // Step 3: Executive Meeting Dossier
      const dossier = await generateMeetingPrepDossier(d1, deal.id);
      expect(dossier.battlecards.length).toBeGreaterThan(0);

      // Step 4: English Executive Proposal Generation
      const proposal = await generateEnterpriseProposal(d1, deal.id, 'en');
      expect(proposal.qualityPassed).toBe(true);
      expect(proposal.wordCount).toBeGreaterThanOrEqual(1200);

      // Step 5: Instant 1-Click Sandbox Workspace Provisioning
      const sandbox = await provisionDemoSandbox(d1, deal.id);
      expect(sandbox.allocatedMcu).toBe(1000);

      // Step 6: Verify final deal state in CRM (proposal sent + sandbox active)
      const finalDeal = await getEnterpriseDealById(d1, deal.id);
      expect(finalDeal?.dealStage).toBe('proposal_sent');
      expect(finalDeal?.sandboxStatus).toBe('active');
      expect(finalDeal?.sandboxSubaccountId).toBe(sandbox.subaccountId);
      expect(finalDeal?.proposalId).toBe(proposal.proposalId);
    });

    it('S2: Vietnamese Enterprise ("MegaShop Vietnam") requiring Vietnamese proposal & localized trial', async () => {
      const deal = await createEnterpriseDeal(d1, {
        leadName: 'Phan Minh Tuan',
        leadEmail: 'tuan.phan@megashop.vn',
        leadPhone: '+84-909-123-456',
        leadTitle: 'Giám Đốc Tiếp Thị Số (CMO)',
        companyName: 'Tập Đoàn Bán Lẻ MegaShop Việt Nam',
        companyDomain: 'megashop.vn',
        leadSource: 'inbound_form',
        requestedMcuMonthly: 150_000,
        dealValueEstimateCents: 12_000_000,
        currency: 'VND',
        notes: 'Cần tự động hóa sản xuất 1,000 video review sản phẩm mỗi tuần với giọng lồng tiếng bản địa.',
        bantInput: {
          statedBudgetArr: 50_000,
          needsApacDubbing: true,
          needsHighVolumeSyndication: true,
          timeframe: 'immediate',
        },
      });

      expect(deal.pipelineTier).toBe('hot');

      // Generate Vietnamese proposal
      const proposalVi = await generateEnterpriseProposal(d1, deal.id, 'vi');
      expect(proposalVi.language).toBe('vi');
      expect(proposalVi.wordCount).toBeGreaterThanOrEqual(1200);
      expect(proposalVi.fullMarkdown).toContain('Tóm tắt điều hành');

      // Activate sandbox
      const sandbox = await provisionDemoSandbox(d1, deal.id);
      expect(sandbox.demoMagicUrl).toContain('/sandbox/');

      const check = await getEnterpriseDealById(d1, deal.id);
      expect(check?.dealStage).toBe('proposal_sent');
      expect(check?.sandboxStatus).toBe('active');
      expect(check?.proposalLanguage).toBe('vi');
    });
  });
});
