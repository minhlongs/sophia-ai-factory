import { BRIEFING_KEY_PREFIX } from './types';

export const CEO_BRIEFING_SYSTEM_PROMPT_EN = `You are the CEO Agent for Sophia AI Factory — a no-code SaaS platform that helps non-technical entrepreneurs run AI-powered video businesses.

Generate a concise daily morning briefing. Structure it with these sections:

## Revenue Snapshot
(Keep generic — Sophia processes payments via NOWPayments)

## Campaign Status
(Refer to the user's campaigns in general terms)

## Active Issues
(Refer to any active issues or items needing attention)

## Summary
A single-line takeaway for the day.

Keep the tone professional, encouraging, and actionable. No more than 4-5 sentences per section.`;

export const CEO_BRIEFING_SYSTEM_PROMPT_VI = `Bạn là CEO Agent của Sophia AI Factory — nền tảng SaaS không cần code giúp các doanh nhân phi kỹ thuật vận hành doanh nghiệp video bằng AI.

Tạo một báo cáo sáng hàng ngày ngắn gọn. Cấu trúc với các phần sau:

## Tổng Quan Doanh Thu
(Giữ tổng quát — Sophia xử lý thanh toán qua NOWPayments)

## Trạng Thái Chiến Dịch
(Đề cập đến các chiến dịch của người dùng một cách tổng quát)

## Vấn Đề Cần Xử Lý
(Đề cập đến các vấn đề hoặc mục cần chú ý)

## Tóm Tắt
Một dòng duy nhất cho ngày hôm nay.

Giữ giọng điệu chuyên nghiệp, khích lệ và có thể hành động. Không quá 4-5 câu mỗi phần.`;

/**
 * Get the today key for memory storage.
 */
export function getTodayKey(): string {
  return `${BRIEFING_KEY_PREFIX}${new Date().toISOString().slice(0, 10)}`;
}

/**
 * Build the user-facing prompt with context.
 */
export function buildBriefingPrompt(locale: string): string {
  const isVietnamese = locale === 'vi';

  if (isVietnamese) {
    return `Tạo báo cáo sáng hàng ngày hôm nay (${new Date().toLocaleDateString('vi-VN')}) cho chủ doanh nghiệp Sophia AI Factory.

Báo cáo cần bằng tiếng Việt, với các phần: Tổng Quan Doanh Thu, Trạng Thái Chiến Dịch, Vấn Đề Cần Xử Lý, và Tóm Tắt.`;
  }

  return `Generate a daily morning briefing for today (${new Date().toLocaleDateString('en-US')}) for a Sophia AI Factory business owner.

The briefing should be in English with sections: Revenue Snapshot, Campaign Status, Active Issues, and Summary.`;
}

/**
 * Parse the raw LLM response into structured sections.
 * Extracts key sections and summary from markdown.
 */
export function parseBriefingSections(rawText: string): { summary: string } {
  // Extract summary — look for ## Summary section or use the last meaningful paragraph
  const summaryMatch = rawText.match(/## (?:Tóm Tắt|Summary)\s*\n+([\s\S]*?)(?=\n##|$)/i);
  if (summaryMatch) {
    return { summary: summaryMatch[1].trim() };
  }

  // Fallback: use the last paragraph
  const paragraphs = rawText.split('\n\n').filter(Boolean);
  return { summary: paragraphs[paragraphs.length - 1]?.trim() ?? rawText.slice(0, 200) };
}
