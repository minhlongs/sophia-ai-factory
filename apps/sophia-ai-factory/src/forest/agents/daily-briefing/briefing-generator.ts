/**
 * @module forest/agents/daily-briefing/briefing-generator
 *
 * CEO Agent Daily Briefing Generator.
 *
 * Generates a once-per-day morning briefing for PREMIUM+ users on the agents page.
 * Uses the existing LLM router (DeepSeek/Anthropic) and agent memory storage.
 *
 * Flow:
 * 1. Check if today's briefing already exists in agent memory.
 * 2. If cached, return immediately.
 * 3. If not, gather context and call LLM with CEO agent prompt.
 * 4. Store the result in agent memory for repeat loads.
 *
 * Import direction: forest imports from seed, tree, and may CALL land for orchestration.
 */

import { memory } from '@/land/openclaw/memory-adapter';
import { resolveLlmRoute } from '@/forest/agent-chat/llm-router';
import { logger } from '@/seed/utils/logger-utility';
import { getErrorMessage } from '@/seed/utils/to-error';
import type { DailyBriefing } from './briefing-types';
import { BRIEFING_MEMORY_TYPE, BRIEFING_KEY_PREFIX } from './briefing-types';

// ── Constants ──────────────────────────────────────────────────────────────────

/** Maximum retries for the LLM call. */
const MAX_LLM_RETRIES = 2;

/** Briefing generation timeout in milliseconds. */
const BRIEFING_TIMEOUT_MS = 15_000;

// ── System Prompt ──────────────────────────────────────────────────────────────

const CEO_BRIEFING_SYSTEM_PROMPT_EN = `You are the CEO Agent for Sophia AI Factory — a no-code SaaS platform that helps non-technical entrepreneurs run AI-powered video businesses.

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

const CEO_BRIEFING_SYSTEM_PROMPT_VI = `Bạn là CEO Agent của Sophia AI Factory — nền tảng SaaS không cần code giúp các doanh nhân phi kỹ thuật vận hành doanh nghiệp video bằng AI.

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

// ── Helpers ────────────────────────────────────────────────────────────────────

/**
 * Get the today key for memory storage.
 */
function getTodayKey(): string {
  return `${BRIEFING_KEY_PREFIX}${new Date().toISOString().slice(0, 10)}`;
}

/**
 * Build the user-facing prompt with context.
 */
function buildBriefingPrompt(locale: string): string {
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
function parseBriefingSections(rawText: string): { summary: string } {
  // Extract summary — look for ## Summary section or use the last meaningful paragraph
  const summaryMatch = rawText.match(/## (?:Tóm Tắt|Summary)\s*\n+([\s\S]*?)(?=\n##|$)/i);
  if (summaryMatch) {
    return { summary: summaryMatch[1].trim() };
  }

  // Fallback: use the last paragraph
  const paragraphs = rawText.split('\n\n').filter(Boolean);
  return { summary: paragraphs[paragraphs.length - 1]?.trim() ?? rawText.slice(0, 200) };
}

/**
 * Call the LLM to generate a briefing text.
 * Returns null if the LLM is not configured or the call fails.
 */
async function callLlmForBriefing(
  userId: string,
  locale: string,
): Promise<string | null> {
  let lastError: string | undefined;

  for (let attempt = 0; attempt < MAX_LLM_RETRIES; attempt++) {
    try {
      const route = await resolveLlmRoute(userId);
      const isVietnamese = locale === 'vi';

      const systemPrompt = isVietnamese
        ? CEO_BRIEFING_SYSTEM_PROMPT_VI
        : CEO_BRIEFING_SYSTEM_PROMPT_EN;

      const userPrompt = buildBriefingPrompt(locale);

      // Non-streaming POST to OpenAI-compatible endpoint
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), BRIEFING_TIMEOUT_MS);

      try {
        const response = await fetch(`${route.baseUrl}/chat/completions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${route.apiKey}`,
          },
          body: JSON.stringify({
            model: route.model,
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: userPrompt },
            ],
            max_tokens: 1024,
            temperature: 0.5,
            stream: false,
          }),
          signal: controller.signal,
        });

        if (!response.ok) {
          const errText = await response.text().catch(() => 'unknown error');
          lastError = `HTTP ${response.status}: ${errText}`;
          logger.warn('[DailyBriefing] LLM call failed', {
            attempt,
            error: lastError,
            status: response.status,
          });
          continue;
        }

        const data = (await response.json()) as {
          choices?: Array<{ message?: { content?: string } }>;
        };
        const content = data?.choices?.[0]?.message?.content;
        if (content) {
          return content;
        }

        lastError = 'Empty response from LLM';
      } finally {
        clearTimeout(timeoutId);
      }
    } catch (err) {
      const isTimeout = err instanceof DOMException && err.name === 'AbortError';
      lastError = isTimeout
        ? `LLM call timed out after ${BRIEFING_TIMEOUT_MS}ms`
        : getErrorMessage(err);

      logger.warn('[DailyBriefing] LLM call attempt failed', {
        attempt,
        error: lastError,
        isTimeout,
      });
    }
  }

  logger.error('[DailyBriefing] All LLM call attempts exhausted', { lastError });
  return null;
}

// ── Public API ─────────────────────────────────────────────────────────────────

/**
 * Generate a daily briefing for a user.
 *
 * Checks for an existing briefing in agent memory first (once-per-day cache).
 * If none exists, calls the LLM to generate a new briefing.
 * Stores the result in agent memory for subsequent loads.
 *
 * @param userId — the user's ID
 * @param locale — the user's locale (for bilingual output)
 * @returns the DailyBriefing, or null if generation failed
 */
export async function generateDailyBriefing(
  userId: string,
  locale = 'en',
): Promise<DailyBriefing | null> {
  const todayKey = getTodayKey();

  // Check memory cache first
  try {
    const cached = (await memory.query(
      BRIEFING_MEMORY_TYPE,
      todayKey,
      userId,
    )) as DailyBriefing | null;

    if (cached && cached.generated) {
      logger.debug('[DailyBriefing] Returning cached briefing', {
        userId,
        date: cached.date,
      });
      return cached;
    }
  } catch (err) {
    // Memory unavailable — proceed with fresh generation
    logger.warn('[DailyBriefing] Memory query failed, generating fresh', {
      error: getErrorMessage(err),
    });
  }

  // Generate fresh briefing via LLM
  const rawText = await callLlmForBriefing(userId, locale);

  const summary = rawText ? parseBriefingSections(rawText).summary : '';
  const generated = rawText !== null;

  const briefing: DailyBriefing = {
    date: new Date().toISOString().slice(0, 10),
    generatedAt: new Date().toISOString(),
    rawText: rawText ?? 'Daily briefing generation is not yet available. Configure your LLM API keys in Settings > Setup Wizard to enable AI-powered briefings.',
    summary,
    locale,
    generated,
  };

  // Store in memory (fire-and-forget — non-critical)
  if (generated) {
    try {
      await memory.store(BRIEFING_MEMORY_TYPE, todayKey, briefing, userId);
      logger.info('[DailyBriefing] Stored new briefing', { userId, date: briefing.date });
    } catch (err) {
      logger.warn('[DailyBriefing] Failed to store briefing in memory', {
        error: getErrorMessage(err),
      });
    }
  }

  return briefing;
}
