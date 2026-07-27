/**
 * LLM Tier Bridge — maps Sophia subscription tiers
 * to internal LLMTier routing keys.
 *
 * Tier routing:
 *   BASIC        → lite       (Qwen 3 32B local)        ← cheapest, needs fallback
 *   PREMIUM      → standard   (Qwen 3 32B local)        ← balanced
 *   ENTERPRISE   → max        (Claude Sonnet/Opus)      ← best quality
 *   MASTER       → max        (Claude Sonnet/Opus)      ← priority queue upstream
 *
 * PHIÊN BẢN 2026-07-27 — Không ghép cấu trúc, khách quan phân tích
 */

import type { LLMTier } from './llm-router';
import type { Tier } from '@/seed/types';

/**
 * Map Sophia subscription tier → LLM router tier.
 *
 * Giá trị mặc định an toàn: nếu tier không hợp lệ trả về 'lite'
 * để tránh spam API đắt tiền khi dữ liệu lỗi.
 */
export function tierToLLMTier(sophiaTier: Tier): LLMTier {
  switch (sophiaTier) {
    case 'BASIC':
      return 'lite';
    case 'PREMIUM':
      return 'standard';
    case 'ENTERPRISE':
    case 'MASTER':
      return 'max';
    default:
      return 'lite';
  }
}

/**
 * Reverse map: LLMTier → Sophia tier name (for observability / logging).
 */
export function llmTierToSophiaTier(llmTier: LLMTier): Tier {
  switch (llmTier) {
    case 'lite':
      return 'BASIC';
    case 'standard':
      return 'PREMIUM';
    case 'max':
      return 'ENTERPRISE';
    default:
      return 'BASIC';
  }
}
