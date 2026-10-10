/**
 * Enterprise Proposal Types, Constants, and Verification Utilities
 * Layer: tree (pure domain logic)
 *
 * @module tree/sales/proposal/types
 */

import type {
  ProposalLanguage,
  ProposalSection,
} from '@/seed/types/enterprise-deal';

export const MINIMUM_WORD_COUNT = 1200;

export const MANDATORY_SECTIONS_EN = [
  'Executive Summary',
  'Strategic Objectives & Bottlenecks',
  'Sophia AI Factory Architecture Blueprint',
  'SLA Commitments (99.9% Uptime) & Security Compliance',
  'Commercial Terms & Volume Discounts',
  'Implementation Roadmap & Key Milestones',
  'Digital Acceptance & Authorization',
];

export const MANDATORY_SECTIONS_VI = [
  'Tóm tắt điều hành',
  'Mục tiêu chiến lược & Thách thức vận hành',
  'Bản thiết kế kiến trúc Sophia AI Factory',
  'Cam kết SLA (99.9% Uptime) & An toàn thông tin',
  'Biểu phí & Chiết khấu khối lượng doanh nghiệp',
  'Lộ trình triển khai & Các cột mốc chính',
  'Thỏa thuận pháp lý & Chữ ký số xác nhận',
];

export interface ProposalQualityResult {
  passed: boolean;
  wordCount: number;
  missingSections: string[];
}

/**
 * Counts words in a markdown string.
 */
export function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

/**
 * Verifies quality compliance of a generated proposal.
 */
export function verifyProposalQuality(
  fullMarkdown: string,
  language: ProposalLanguage,
): ProposalQualityResult {
  const wordCount = countWords(fullMarkdown);
  const mandatory = language === 'vi' ? MANDATORY_SECTIONS_VI : MANDATORY_SECTIONS_EN;

  const missingSections = mandatory.filter((sec) => !fullMarkdown.toLowerCase().includes(sec.toLowerCase()));

  const passed = wordCount >= MINIMUM_WORD_COUNT && missingSections.length === 0;

  return { passed, wordCount, missingSections };
}

/**
 * Parses markdown proposal into structured sections.
 */
export function parseProposalSections(fullMarkdown: string): ProposalSection[] {
  const lines = fullMarkdown.split('\n');
  const sections: ProposalSection[] = [];
  let currentTitle = '';
  let currentContentLines: string[] = [];

  for (const line of lines) {
    if (line.startsWith('## ')) {
      if (currentTitle) {
        sections.push({
          title: currentTitle,
          content: currentContentLines.join('\n').trim(),
        });
      }
      currentTitle = line.replace(/^##\s+/, '').trim();
      currentContentLines = [];
    } else {
      currentContentLines.push(line);
    }
  }

  if (currentTitle) {
    sections.push({
      title: currentTitle,
      content: currentContentLines.join('\n').trim(),
    });
  }

  return sections;
}
