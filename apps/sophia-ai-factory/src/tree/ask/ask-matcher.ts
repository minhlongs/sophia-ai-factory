/**
 * Bilingual Natural Language Ask Router — Matching & Routing Engine
 *
 * Layer: tree/ask
 * @module tree/ask/ask-matcher
 */

import { logger } from '@/seed/utils/logger-utility';
import type { AskRouteResult, IntentCategoryDefinition } from './ask-types';
import { CANONICAL_INTENT_CATEGORIES, RECOGNIZED_COMMANDS } from './ask-intent-categories';
import {
  formatConsultationMessages,
  generateArchitecturalConsultation,
} from './ask-advisor-consultation';

/**
 * Checks if a candidate text matches a pattern using fnmatch wildcard semantics.
 */
export function matchesWildcard(pattern: string, text: string): boolean {
  const normPattern = pattern.trim().toLowerCase();
  const normText = text.trim().toLowerCase();

  if (normPattern.length === 0 || normText.length === 0) {
    return false;
  }

  if (normPattern.startsWith('*') && normPattern.endsWith('*')) {
    const sub = normPattern.slice(1, -1);
    return sub.length > 0 && normText.includes(sub);
  }

  if (normPattern.startsWith('*')) {
    const sub = normPattern.slice(1);
    return sub.length > 0 && normText.endsWith(sub);
  }

  if (normPattern.endsWith('*')) {
    const sub = normPattern.slice(0, -1);
    return sub.length > 0 && normText.startsWith(sub);
  }

  return normText.includes(normPattern);
}

interface MatchCandidate {
  readonly intent: IntentCategoryDefinition;
  readonly keyword: string;
  readonly language: 'vi' | 'en';
  readonly specificity: number;
}

function checkUnknownCommand(trimmed: string): AskRouteResult | null {
  if (!trimmed.startsWith('/')) {
    return null;
  }
  const commandToken = trimmed.split(/\s+/)[0]?.toLowerCase() ?? '';
  if (commandToken.length <= 1 || RECOGNIZED_COMMANDS.has(commandToken)) {
    return null;
  }

  logger.info(`[AskRouter] Rejected unknown command: ${commandToken}`);
  return {
    query: trimmed,
    mode: 'unknown-command-rejected',
    rejectionReason: {
      vi: `Lệnh "${commandToken}" không tồn tại hoặc không được hỗ trợ trong danh mục lệnh cho phép.`,
      en: `Command "${commandToken}" does not exist or is not permitted in the system allowlist.`,
    },
    outputMessageVi: `❌ [Từ chối lệnh] Lệnh "${commandToken}" không được công nhận. Vui lòng sử dụng các lệnh chuẩn như /cook, /fix, /test, /plan, /brainstorm, /docs, /security-scan, /audit-compliance hoặc nhập câu hỏi tự nhiên.`,
    outputMessageEn: `❌ [Command Rejected] Command "${commandToken}" is unrecognized. Please use supported commands (/cook, /fix, /test, /plan, /brainstorm, /docs, /security-scan, /audit-compliance) or enter a natural language prompt.`,
  };
}

function findBestIntentMatch(trimmed: string, language: 'vi' | 'en'): MatchCandidate | null {
  const matches: MatchCandidate[] = [];
  for (const intent of CANONICAL_INTENT_CATEGORIES) {
    const keywords = language === 'vi' ? intent.keywordsVi : intent.keywordsEn;
    for (const kw of keywords) {
      if (matchesWildcard(kw, trimmed)) {
        matches.push({
          intent,
          keyword: kw,
          language,
          specificity: kw.length,
        });
      }
    }
  }
  if (matches.length === 0) {
    return null;
  }
  matches.sort((a, b) => b.specificity - a.specificity);
  return matches[0] ?? null;
}

function buildRoutedResult(trimmed: string, match: MatchCandidate): AskRouteResult {
  const langLabel = match.language.toUpperCase();
  logger.info(`[AskRouter] Matched ${langLabel} intent "${match.intent.id}" with keyword "${match.keyword}"`);
  return {
    query: trimmed,
    mode: 'command-routed',
    matchedIntent: match.intent,
    matchedKeyword: match.keyword,
    matchedLanguage: match.language,
    targetCommand: match.intent.targetCommand,
    outputMessageVi: `➡️ [Định tuyến thành công] Yêu cầu của bạn khớp với mục đích "${match.intent.nameVi}". Đang chuyển hướng sang lệnh: ${match.intent.targetCommand}`,
    outputMessageEn: `➡️ [Routed Successfully] Your request matched intent "${match.intent.nameEn}". Redirecting to target command: ${match.intent.targetCommand}`,
  };
}

/**
 * Natural Language /ask Router.
 */
export function routeAsk(query: string): AskRouteResult {
  const trimmed = (query ?? '').trim();

  const rejected = checkUnknownCommand(trimmed);
  if (rejected) {
    return rejected;
  }

  const bestVi = findBestIntentMatch(trimmed, 'vi');
  if (bestVi) {
    return buildRoutedResult(trimmed, bestVi);
  }

  const bestEn = findBestIntentMatch(trimmed, 'en');
  if (bestEn) {
    return buildRoutedResult(trimmed, bestEn);
  }

  logger.info(`[AskRouter] No keyword match; falling back to 4-Advisor architectural consultation for query: "${trimmed}"`);
  const consultation = generateArchitecturalConsultation(trimmed);
  const { outputMessageVi, outputMessageEn } = formatConsultationMessages(trimmed, consultation);

  return {
    query: trimmed,
    mode: 'architecture-consultation',
    consultation,
    outputMessageVi,
    outputMessageEn,
  };
}
