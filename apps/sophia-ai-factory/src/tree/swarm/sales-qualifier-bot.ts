/**
 * Autonomous Sales Qualifier Bot & B2B Inbound Triage Engine
 *
 * Layer: tree/swarm (Domain services & pure algorithms)
 * Dependencies:
 *   - @/seed/types/autonomous-swarm
 *   - @/seed/types/enterprise-deal
 *   - @/seed/db/client
 *   - @/seed/utils/logger-utility
 *   - @/tree/sales/bant-scoring-service
 *
 * Implements:
 * - Real-time BANT 4-factor scoring (Budget, Authority, Need, Timeline: 0 to 100)
 * - Corporate domain validation & disposable domain filtering
 * - Dynamic pipeline routing (hot, warm, cold)
 * - Executive bilingual proposal drafting (EN & VI)
 * - AI Meeting Prep Brief generation for sales executives
 * - Edge swarm node dispatch and telemetry integration
 *
 * @module tree/swarm/sales-qualifier-bot
 */

import type { D1Database } from '@/seed/db/client';
import type {
  InboundLeadPayload,
  QualificationResult,
} from '@/seed/types/autonomous-swarm';
import type { BantScoreInput } from '@/seed/types/enterprise-deal';
import {
  calculateBantScore,
  isCorporateEmailDomain,
} from '@/tree/sales/bant-scoring-service';
import { logger } from '@/seed/utils/logger-utility';

/**
 * Generates an executive bilingual proposal (EN + VI) for qualified leads.
 */
export function generateBilingualProposal(
  lead: InboundLeadPayload,
  bantScore: number,
  recommendedTier: string
): string {
  const mcuFormatted = (lead.requestedMcuMonthly ?? 50_000).toLocaleString('en-US');
  const arrUsd = lead.dealValueEstimateCents
    ? `$${(lead.dealValueEstimateCents / 100).toLocaleString('en-US')}`
    : '$24,000 - $60,000';

  return `
================================================================================
SOPHIA AI FACTORY — ENTERPRISE SOLUTION PROPOSAL
BẢN ĐỀ XUẤT GIẢI PHÁP DOANH NGHIỆP TỰ TRỊ
================================================================================

Target Client / Khách hàng: ${lead.companyName} (${lead.companyDomain})
Primary Contact / Đại diện: ${lead.leadName} (${lead.leadTitle ?? 'Decision Maker'})
Qualification Score / Điểm BANT: ${bantScore}/100 [AUTO-QUALIFIED]
Recommended Plan / Gói khuyến nghị: ${recommendedTier}

--------------------------------------------------------------------------------
1. EXECUTIVE SUMMARY / TỔNG QUAN GIẢI PHÁP
--------------------------------------------------------------------------------
EN:
Sophia AI Factory offers an autonomous multi-modal AI video engine designed to
scale ${lead.companyName}'s global distribution. With our Dedicated Edge GPU Lane,
autonomous APAC dubbing in 5 languages (VI, EN, JA, KO, TH), and multi-platform
syndication, your marketing and growth operations achieve 10x velocity.

VI:
Sophia AI Factory cung cấp cỗ máy sản xuất video AI tự trị đa phương thức được
thiết kế tối ưu cho quy mô tiếp thị toàn cầu của ${lead.companyName}. Với làn GPU
chuyên dụng trên Edge, lồng tiếng APAC 5 ngôn ngữ bản xứ và tự động phát hành
đa kênh, doanh nghiệp đạt bước nhảy vọt gấp 10 lần hiệu suất tăng trưởng.

--------------------------------------------------------------------------------
2. COMMERCIAL COMMITMENTS / CAM KẾT THƯƠNG MẠI
--------------------------------------------------------------------------------
- Monthly Quota / Hạn ngạch hàng tháng: ${mcuFormatted} MCU
- Estimated Annual Value / Giá trị hợp đồng: ${arrUsd}/year
- Uptime SLA / Cam kết độ khả dụng: 99.999% Five-Nines Edge SLA
- Data Residency / Quyền riêng tư dữ liệu: Sovereign In-Region Data Processing

--------------------------------------------------------------------------------
3. NEXT STEPS / BƯỚC TRIỂN KHAI TIẾP THEO
--------------------------------------------------------------------------------
1. 1-Click Sandbox Demo Workspace Activation.
2. Technical Architecture & Dedicated GPU Lane Allocation Review.
3. SLA & Volume Contract Execution via Cryptographic Signature.
`.trim();
}

/**
 * Generates an internal Meeting Prep Brief for account executives.
 */
export function generateMeetingPrepBrief(
  lead: InboundLeadPayload,
  result: {
    bantScore: number;
    pipelineTier: string;
    scoringFactors: { budgetScore: number; authorityScore: number; needScore: number; timelineScore: number };
  }
): string {
  return `
[AI SALES QUALIFIER BRIEF]
Company: ${lead.companyName} | Domain: ${lead.companyDomain}
Lead: ${lead.leadName} (${lead.leadTitle ?? 'Title Not Specified'})
Tier: ${result.pipelineTier.toUpperCase()} (${result.bantScore}/100)
Scores: Budget=${result.scoringFactors.budgetScore}/25, Authority=${result.scoringFactors.authorityScore}/25, Need=${result.scoringFactors.needScore}/25, Timeline=${result.scoringFactors.timelineScore}/25

Key Discovery Questions:
1. What is the current bottleneck in ${lead.companyName}'s localized video output?
2. Are they currently evaluating external GPU clusters or in-house models?
3. What is their target timeline for full regional syndication rollout?
Recommended Strategy:
- For Hot Tier: Immediately provision demo sandbox and present 99.999% SLA commitment.
- For Warm Tier: Schedule 20-min technical discovery and share APAC dubbing benchmarks.
`.trim();
}

/**
 * Pure function: Qualifies an inbound enterprise lead using BANT framework.
 */
export function qualifyInboundLead(payload: InboundLeadPayload): QualificationResult {
  const isCorporate = isCorporateEmailDomain(payload.leadEmail);
  const notesLower = (payload.notes ?? '').toLowerCase();

  // Extract needs signals from notes and payload
  const needsApacDubbing = notesLower.includes('dub') || notesLower.includes('vietnam') || notesLower.includes('apac') || notesLower.includes('language');
  const needsDedicatedGpuLane = notesLower.includes('gpu') || notesLower.includes('dedicated') || (payload.requestedMcuMonthly ?? 0) >= 50_000;
  const needsHighVolumeSyndication = notesLower.includes('syndicat') || notesLower.includes('bulk') || notesLower.includes('youtube') || notesLower.includes('tiktok');
  const needsCustomApiOrWhiteLabel = notesLower.includes('api') || notesLower.includes('white') || notesLower.includes('reseller');

  const bantInput: BantScoreInput = {
    statedBudgetArr: payload.dealValueEstimateCents
      ? Math.floor(payload.dealValueEstimateCents / 100)
      : undefined,
    statedMonthlyMcu: payload.requestedMcuMonthly,
    jobTitle: payload.leadTitle,
    isCorporateEmail: isCorporate,
    leadEmail: payload.leadEmail,
    needsApacDubbing,
    needsDedicatedGpuLane,
    needsHighVolumeSyndication,
    needsCustomApiOrWhiteLabel,
    statedBottleneckOrPainPoint: payload.notes,
    timeframe: payload.timeframe ?? '1_to_3_months',
  };

  const bantResult = calculateBantScore(bantInput);
  const totalScore = bantResult.totalScore;
  const pipelineTier = bantResult.pipelineTier;

  let dealStage: string;
  let assignedAgentRole: string;
  let autoQualified = false;
  let recommendedTier = 'ENTERPRISE';

  if (pipelineTier === 'hot') {
    dealStage = 'qualified';
    assignedAgentRole = 'ai_sales_executive';
    autoQualified = true;
    recommendedTier = (payload.requestedMcuMonthly ?? 0) >= 200_000 ? 'MASTER' : 'ENTERPRISE';
  } else if (pipelineTier === 'warm') {
    dealStage = 'enriching';
    assignedAgentRole = 'ai_sales_executive';
    autoQualified = false;
    recommendedTier = 'PREMIUM';
  } else {
    dealStage = 'new_lead';
    assignedAgentRole = 'unassigned';
    autoQualified = false;
    recommendedTier = 'BASIC';
  }

  const scoringFactors = {
    budgetScore: bantResult.budgetScore,
    authorityScore: bantResult.authorityScore,
    needScore: bantResult.needScore,
    timelineScore: bantResult.timelineScore,
  };

  const dealId = `deal_${payload.companyDomain.replace(/[^a-zA-Z0-9]/g, '_')}_${Math.random().toString(16).slice(2, 10)}`;

  const proposalContent = (pipelineTier === 'hot' || pipelineTier === 'warm')
    ? generateBilingualProposal(payload, totalScore, recommendedTier)
    : undefined;

  const meetingPrepBrief = generateMeetingPrepBrief(payload, {
    bantScore: totalScore,
    pipelineTier,
    scoringFactors,
  });

  return {
    dealId,
    bantScore: totalScore,
    pipelineTier,
    dealStage,
    assignedAgentRole,
    proposalContent,
    meetingPrepBrief,
    autoQualified,
    scoringFactors,
  };
}

/**
 * Orchestrates lead qualification through an edge swarm node.
 * Records telemetry and updates node task metrics if node is specified.
 */
export async function processLeadWithSwarmNode(
  db: D1Database,
  payload: InboundLeadPayload,
  swarmNodeId?: string
): Promise<QualificationResult> {
  const result = qualifyInboundLead(payload);

  if (swarmNodeId) {
    try {
      await db
        .prepare(`
          UPDATE autonomous_swarm_nodes
          SET
            active_tasks = MAX(0, active_tasks + 1),
            last_heartbeat_at = ?1,
            updated_at = ?1
          WHERE id = ?2
        `)
        .bind(Date.now(), swarmNodeId)
        .run();
    } catch (err) {
      logger.warn('[sales-qualifier-bot] Failed to update swarm node telemetry', {
        swarmNodeId,
        error: String(err),
      });
    }
  }

  logger.info('[sales-qualifier-bot] Inbound lead qualified', {
    dealId: result.dealId,
    company: payload.companyName,
    bantScore: result.bantScore,
    pipelineTier: result.pipelineTier,
    autoQualified: result.autoQualified,
  });

  return result;
}
