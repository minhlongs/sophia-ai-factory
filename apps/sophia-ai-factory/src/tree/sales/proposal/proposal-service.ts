/**
 * Enterprise Proposal Generation Service
 * Layer: tree (pure domain logic)
 *
 * @module tree/sales/proposal/proposal-service
 */

import type { D1Database } from '@/seed/db/client';
import type {
  ProposalLanguage,
  EnterpriseProposalResult,
} from '@/seed/types/enterprise-deal';
import { logger } from '@/seed/utils/logger-utility';
import { resilientChatCompletion } from '@/seed/inference/openrouter-client';
import {
  getEnterpriseDealById,
  updateEnterpriseDeal,
  getLeadEnrichmentByDomain,
} from '../enterprise-deal-repo';
import { verifyProposalQuality, parseProposalSections } from './types';
import { buildCanonicalEnglishProposal } from './pricing-calculator';
import { buildCanonicalVietnameseProposal } from './terms-generator';

/**
 * Generates an executive enterprise solution proposal in English or Vietnamese.
 */
export async function generateEnterpriseProposal(
  db: D1Database,
  dealId: string,
  language: ProposalLanguage = 'en',
  openRouterApiKey?: string,
): Promise<EnterpriseProposalResult> {
  const deal = await getEnterpriseDealById(db, dealId);
  if (!deal) {
    throw new Error(`Enterprise deal not found: ${dealId}`);
  }

  const enrichment = await getLeadEnrichmentByDomain(db, deal.companyDomain);
  const industry = enrichment?.industry || 'Technology & Digital Media';

  let fullMarkdown = '';

  const prompt = `You are the Principal Enterprise Solutions Architect at Sophia AI Factory.
Generate an exhaustive, publication-grade enterprise solution proposal for ${deal.companyName} (${deal.companyDomain}).
Language: ${language === 'vi' ? 'Vietnamese (Tiếng Việt chuyên nghiệp, trang trọng)' : 'English (Executive Business Professional)'}.

You MUST write a comprehensive document of AT LEAST 1,200 words covering EXACTLY these 7 sections in H2 format:
1. ${language === 'vi' ? '## 1. Tóm tắt điều hành' : '## 1. Executive Summary'}
2. ${language === 'vi' ? '## 2. Mục tiêu chiến lược & Thách thức vận hành' : '## 2. Strategic Objectives & Bottlenecks'}
3. ${language === 'vi' ? '## 3. Bản thiết kế kiến trúc Sophia AI Factory' : '## 3. Sophia AI Factory Architecture Blueprint'}
4. ${language === 'vi' ? '## 4. Cam kết SLA (99.9% Uptime) & An toàn thông tin' : '## 4. SLA Commitments (99.9% Uptime) & Security Compliance'}
5. ${language === 'vi' ? '## 5. Biểu phí & Chiết khấu khối lượng doanh nghiệp' : '## 5. Commercial Terms & Volume Discounts'}
6. ${language === 'vi' ? '## 6. Lộ trình triển khai & Các cột mốc chính' : '## 6. Implementation Roadmap & Key Milestones'}
7. ${language === 'vi' ? '## 7. Thỏa thuận pháp lý & Chữ ký số xác nhận' : '## 7. Digital Acceptance & Authorization'}

Details:
Lead: ${deal.leadName}, ${deal.leadTitle || 'Executive'}
Deal Value: $${((deal.dealValueEstimateCents || 5000000) / 100).toLocaleString()} USD
Monthly MCUs: ${(deal.requestedMcuMonthly || 100000).toLocaleString()} MCU
Industry: ${industry}`;

  try {
    const response = await resilientChatCompletion(prompt, {
      openRouterKey: openRouterApiKey || process.env.OPENROUTER_API_KEY || null,
      model: 'openai/gpt-4o-mini',
    });

    const quality = verifyProposalQuality(response, language);
    if (quality.passed) {
      fullMarkdown = response;
    } else {
      logger.warn('[enterprise-proposal] AI response failed word count or section check, using canonical template', {
        dealId,
        wordCount: quality.wordCount,
        missing: quality.missingSections,
      });
      fullMarkdown = language === 'vi' ? buildCanonicalVietnameseProposal(deal, industry) : buildCanonicalEnglishProposal(deal, industry);
    }
  } catch (err) {
    logger.warn('[enterprise-proposal] OpenRouter inference failed or offline, using canonical template', {
      dealId,
      error: String(err),
    });
    fullMarkdown = language === 'vi' ? buildCanonicalVietnameseProposal(deal, industry) : buildCanonicalEnglishProposal(deal, industry);
  }

  const quality = verifyProposalQuality(fullMarkdown, language);
  const sections = parseProposalSections(fullMarkdown);
  const proposalId = `prop_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`;

  // Update deal with generated proposal and transition stage to proposal_sent
  await updateEnterpriseDeal(db, dealId, {
    proposalId,
    proposalLanguage: language,
    proposalContent: fullMarkdown,
    dealStage: deal.dealStage === 'new_lead' || deal.dealStage === 'qualified' || deal.dealStage === 'demo_prepared'
      ? 'proposal_sent'
      : deal.dealStage,
  });

  return {
    proposalId,
    dealId,
    language,
    title: language === 'vi' ? `Đề Xuất Giải Pháp Doanh Nghiệp — ${deal.companyName}` : `Enterprise Solution Proposal — ${deal.companyName}`,
    sections,
    fullMarkdown,
    wordCount: quality.wordCount,
    qualityPassed: quality.passed,
    generatedAt: Date.now(),
  };
}
