/**
 * Bilingual Natural Language Ask Router — Matching & Routing Engine
 *
 * Layer: tree/ask
 * @module tree/ask/ask-matcher
 */

import { logger } from '@/seed/utils/logger-utility';
import type { AskRouteResult } from './ask-types';
import { RECOGNIZED_COMMANDS } from './ask-intent-categories';
import {
  formatConsultationMessages,
  generateArchitecturalConsultation,
} from './ask-advisor-consultation';
import {
  findBestIntentMatch,
  matchesWildcard,
  type MatchCandidate,
} from './ask-wildcard-matcher';

export { matchesWildcard };

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
