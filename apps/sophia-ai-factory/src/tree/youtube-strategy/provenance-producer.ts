/**
 * Deterministic zero-LLM provenance claim & source producer for publish dispatchers.
 *
 * Scans scripts, titles, and captions for high-risk verifiable assertions
 * (quantitative outcome percentages, monetary income/profit promises, and
 * medical/scientific/regulatory proof claims in English and Vietnamese) while
 * ignoring benign narrative numbers (`Top 5`, `3 steps`, `1080p`, `24/7`, `2026`,
 * URLs, hashtags, and Sophia's own compliance disclosure clauses).
 *
 * Layer: tree (pure domain policy — zero I/O, zero LLM calls, zero external keys).
 * @module tree/youtube-strategy/provenance-producer
 */

import type { ProvenanceInput } from '@/seed/types/provenance';
import { normalizeSources } from './provenance/normalizer';
import type { NormalizedSource } from './provenance/types';

export interface ScriptSceneTextLike {
  readonly narration?: string;
}

export interface ScriptContentLike {
  readonly title?: string;
  readonly scenes?: readonly ScriptSceneTextLike[];
}

export interface ProducePublishProvenanceInput {
  readonly title?: string | null;
  readonly description?: string | null;
  readonly caption?: string | null;
  readonly scriptText?: string | null;
  readonly script?: ScriptContentLike | Record<string, unknown> | null;
  readonly sources?: readonly Record<string, unknown>[];
  readonly provenance?: ProvenanceInput;
  readonly containsSyntheticMedia?: boolean;
}

const MAX_FIELD_LENGTH = 20_000;
const MAX_SCENE_NARRATION_LENGTH = 4_000;
const MAX_SCENES_SCANNED = 50;
const MAX_SEGMENT_LENGTH = 500;
const WINDOW_STRIDE = 400;

const SYSTEM_DISCLOSURE_CLAUSE_PATTERNS: readonly RegExp[] = [
  /#ad\s*\|\s*this content contains affiliate links and i may earn a commission at no cost to you\.?/gi,
  /#quảngcáo\s*\|\s*nội dung này có chứa liên kết affiliate\s*[—-]\s*nếu bạn mua qua đường link đó,\s*chúng tôi có thể nhận hoa hồng,\s*không mất thêm chi phí gì ở bạn\.?/giu,
  /(?:financial disclaimer:\s*)?crypto is highly volatile[^.!?\n]{0,120}not financial advice\.?/gi,
  /(?:miễn trừ trách nhiệm tài chính:\s*)?không phải lời khuyên tài chính\.?/giu,
  /\bnot financial advice\b/gi,
  /(?<![\p{L}\p{M}\p{N}_])không phải lời khuyên tài chính(?![\p{L}\p{M}\p{N}_])/giu,
];

const QUANT_OUTCOME_PATTERNS: readonly RegExp[] = [
  /(?<![\p{L}\p{M}\p{N}_])(?:boost(?:s|ed|ing)?|increas(?:e|es|ed|ing)|grow(?:s|n|ing)?|grew|improv(?:e|es|ed|ing)|reduc(?:e|es|ed|ing)|cut(?:s|ting)?|sav(?:e|es|ed|ing)|convert(?:s|ed|ing)?|conversions?|yield(?:s|ed|ing)?|return(?:s|ed|ing)?|apy|apr|roi|accuracy|win\s*rate)(?![\p{L}\p{M}\p{N}_])[^.!?\n]{0,45}(?<![\p{L}\p{M}\p{N}_])\d+(?:[.,]\d+)?\s*%/iu,
  /(?<![\p{L}\p{M}\p{N}_])\d+(?:[.,]\d+)?\s*%[^.!?\n]{0,45}(?<![\p{L}\p{M}\p{N}_])(?:faster|higher|more\s+sales|more\s+revenue|profits?|returns?|roi|apy|apr|guaranteed|success\s+rate|effective|accurate|growth|conversions?)(?![\p{L}\p{M}\p{N}_])/iu,
  /(?<![\p{L}\p{M}\p{N}_])100\s*%\s*(?:guaranteed|effective|safe|risk[- ]free|proven|cam\s+kết|đảm\s+bảo|hiệu\s+quả|an\s+toàn)(?![\p{L}\p{M}\p{N}_])/iu,
  /(?<![\p{L}\p{M}\p{N}_])(?:tăng(?:\s+trưởng)?|giảm|tiết\s+kiệm|lợi\s+nhuận|lãi\s+suất|hiệu\s+suất|tỷ\s+lệ\s+chuyển\s+đổi|tỷ\s+lệ\s+thắng)(?![\p{L}\p{M}\p{N}_])[^.!?\n]{0,45}(?<![\p{L}\p{M}\p{N}_])\d+(?:[.,]\d+)?\s*%/iu,
];

const MONETARY_PROMISE_PATTERNS: readonly RegExp[] = [
  /(?<![\p{L}\p{M}\p{N}_])(?:earn(?:s|ed|ing)?|mak(?:e|es|ing)|made|generat(?:e|es|ed|ing)|net(?:s|ted|ting)?|profit(?:s|ed|ing)?|pocket(?:s|ed|ing)?)(?![\p{L}\p{M}\p{N}_])[^.!?\n]{0,35}(?:\$\s?\d+(?:[,.]\d+)*(?:\s*[kmb])?(?![\p{L}\p{M}\p{N}_])|(?<![\p{L}\p{M}\p{N}_])\d+(?:[,.]\d+)*\s*(?:usd|dollars?)(?![\p{L}\p{M}\p{N}_]))/iu,
  /(?:\$\s?\d+(?:[,.]\d+)*(?:\s*[kmb])?(?![\p{L}\p{M}\p{N}_,.])|(?<![\p{L}\p{M}\p{N}_$,.])\d+(?:[,.]\d+)*\s*(?:usd|dollars?)(?![\p{L}\p{M}\p{N}_]))[^.!?\n]{0,35}(?<![\p{L}\p{M}\p{N}_])(?:per\s+(?:day|week|month|year)|a\s+(?:day|week|month)|every\s+(?:day|week|month|year)|passive\s+income|guaranteed|profits?)(?![\p{L}\p{M}\p{N}_])/iu,
  /(?<![\p{L}\p{M}\p{N}_])\d+(?:[.,]\d+)?\s*x\s+(?:your\s+money|returns?|roi|profits?|lợi\s+nhuận|tài\s+khoản|vốn)(?![\p{L}\p{M}\p{N}_])/iu,
  /(?<![\p{L}\p{M}\p{N}_])(?:kiếm(?:\s+được)?|thu\s+nhập|lãi(?:\s+ròng)?|bỏ\s+túi)(?![\p{L}\p{M}\p{N}_])[^.!?\n]{0,35}(?:\$\s?\d+(?:[,.]\d+)*(?:\s*[kmb])?(?![\p{L}\p{M}\p{N}_])|(?<![\p{L}\p{M}\p{N}_])\d+(?:[,.]\d+)*\s*(?:(?:triệu|tỷ(?!\s+lệ)|nghìn\s*đô|usd)(?![\p{L}\p{M}\p{N}_])|\$))/iu,
];

const MEDICAL_REGULATORY_PATTERNS: readonly RegExp[] = [
  /(?<![\p{L}\p{M}\p{N}_])(?:clinically\s+proven|scientifically\s+proven|fda[- ]approved|doctor[- ]recommended|peer[- ]reviewed\s+stud(?:y|ies)|cures?\s+(?:diabetes|cancer|insomnia|arthritis|hypertension|depression))(?![\p{L}\p{M}\p{N}_])/iu,
  /(?<![\p{L}\p{M}\p{N}_])(?:chứng\s+minh\s+lâm\s+sàng|nghiên\s+cứu\s+(?:khoa\s+học\s+)?chứng\s+minh|được\s+fda\s+chấp\s+thuận|bộ\s+y\s+tế\s+cấp\s+phép|chữa\s+khỏi(?:\s+hoàn\s+toàn|\s+dứt\s+điểm)?)(?![\p{L}\p{M}\p{N}_])/iu,
];

function extractScriptNarration(script: ProducePublishProvenanceInput['script']): string {
  if (!script || typeof script !== 'object') return '';
  const parts: string[] = [];
  const maybeTitle = (script as { title?: unknown }).title;
  if (typeof maybeTitle === 'string' && maybeTitle.trim()) {
    parts.push(maybeTitle.trim().slice(0, MAX_SCENE_NARRATION_LENGTH));
  }
  const maybeScenes = (script as { scenes?: unknown }).scenes;
  if (Array.isArray(maybeScenes)) {
    for (const scene of maybeScenes.slice(0, MAX_SCENES_SCANNED)) {
      if (scene && typeof scene === 'object') {
        const narration = (scene as { narration?: unknown }).narration;
        if (typeof narration === 'string' && narration.trim()) {
          parts.push(narration.trim().slice(0, MAX_SCENE_NARRATION_LENGTH));
        }
      }
    }
  }
  return parts.join('\n');
}

function sanitizeForClaimScan(raw: string): string {
  let text = raw.normalize('NFC').slice(0, MAX_FIELD_LENGTH * 5);
  for (const re of SYSTEM_DISCLOSURE_CLAUSE_PATTERNS) {
    text = text.replace(re, ' . ');
  }
  return text
    .replace(/https?:\/\/\S+/gi, ' ')
    .replace(/(^|\s)#[\p{L}\p{M}\p{N}_-]+/gu, ' ')
    .replace(/[.!?]{2,}/g, '.');
}

function classifyHighRiskClaim(sentence: string): boolean {
  return (
    MEDICAL_REGULATORY_PATTERNS.some((re) => re.test(sentence)) ||
    MONETARY_PROMISE_PATTERNS.some((re) => re.test(sentence)) ||
    QUANT_OUTCOME_PATTERNS.some((re) => re.test(sentence))
  );
}

function sliceIntoWindows(segment: string): string[] {
  if (segment.length <= MAX_SEGMENT_LENGTH) return [segment];
  const windows: string[] = [];
  for (let offset = 0; offset < segment.length; offset += WINDOW_STRIDE) {
    windows.push(segment.slice(offset, offset + MAX_SEGMENT_LENGTH));
    if (offset + MAX_SEGMENT_LENGTH >= segment.length) break;
  }
  return windows;
}

/** Extract deterministic high-risk factual claims from candidate publish text. */
export function extractVerifiableClaims(rawText: string): string[] {
  const cleaned = sanitizeForClaimScan(rawText);
  const segments = cleaned
    .split(/(?:[.!?](?=\s|$)|\n+)/)
    .map((s) => s.replace(/\s+/g, ' ').trim())
    .filter((s) => s.length >= 8);

  const seen = new Set<string>();
  const claims: string[] = [];
  for (const segment of segments) {
    for (const candidate of sliceIntoWindows(segment)) {
      if (!classifyHighRiskClaim(candidate)) continue;
      const key = candidate.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      claims.push(candidate);
    }
  }
  return claims;
}

function serializeNormalizedSources(sources: readonly NormalizedSource[]): Record<string, unknown>[] {
  return sources.map((s) => ({
    id: s.id,
    url: s.url,
    title: s.title,
    publisher: s.publisher,
    ...(s.publishedAt ? { publishedAt: s.publishedAt } : {}),
    accessedAt: s.accessedAt,
    sourceType: s.sourceType,
    status: s.status,
    ...(s.notes ? { notes: s.notes } : {}),
  }));
}

function isCoveredByCallerClaim(extractedText: string, callerClaims: readonly Record<string, unknown>[]): boolean {
  const needle = extractedText.normalize('NFC').trim().toLowerCase();
  if (needle.length < 8) return false;
  return callerClaims.some((c) => {
    const raw = typeof c?.text === 'string' ? c.text : typeof c?.claim === 'string' ? c.claim : '';
    const existing = raw.normalize('NFC').trim().toLowerCase();
    return existing === needle || existing.includes(needle);
  });
}

function resolveSourcesState(rawSources: unknown): {
  readonly hasRawSources: boolean;
  readonly verifiedSourceIds: readonly string[];
  readonly sourcesField: { readonly sources?: readonly Record<string, unknown>[] };
} {
  const hasRawSources = Array.isArray(rawSources)
    ? rawSources.length > 0
    : rawSources !== undefined && rawSources !== null;

  if (!Array.isArray(rawSources)) {
    return {
      hasRawSources,
      verifiedSourceIds: [],
      sourcesField: hasRawSources ? { sources: rawSources as readonly Record<string, unknown>[] } : {},
    };
  }

  try {
    const normalized = normalizeSources(rawSources);
    return {
      hasRawSources,
      verifiedSourceIds: normalized.filter((s) => s.status === 'verified').map((s) => s.id),
      sourcesField: normalized.length > 0 ? { sources: serializeNormalizedSources(normalized) } : {},
    };
  } catch {
    return {
      hasRawSources,
      verifiedSourceIds: [],
      sourcesField: hasRawSources ? { sources: rawSources } : {},
    };
  }
}

/**
 * Build a cross-layer `ProvenanceInput` payload for YouTube/social dispatchers.
 *
 * `containsSyntheticMedia` defaults to `true` and only honors an explicit
 * `input.containsSyntheticMedia === false` (never an untrusted nested
 * `input.provenance.containsSyntheticMedia` override).
 */
export function producePublishProvenance(input: ProducePublishProvenanceInput = {}): ProvenanceInput {
  const containsSyntheticMedia = input.containsSyntheticMedia ?? true;

  if (input.provenance?.claims !== undefined && !Array.isArray(input.provenance.claims)) {
    return { ...input.provenance, containsSyntheticMedia };
  }

  const { hasRawSources, verifiedSourceIds, sourcesField } = resolveSourcesState(
    input.provenance?.sources ?? input.sources,
  );

  const corpus = [
    (input.title ?? '').slice(0, MAX_FIELD_LENGTH),
    (input.scriptText ?? '').slice(0, MAX_FIELD_LENGTH),
    extractScriptNarration(input.script),
    (input.caption ?? '').slice(0, MAX_FIELD_LENGTH),
    (input.description ?? '').slice(0, MAX_FIELD_LENGTH),
  ]
    .filter((part) => part.trim().length > 0)
    .join('\n');

  const callerClaims = Array.isArray(input.provenance?.claims) ? input.provenance.claims : [];
  const extractedClaims = extractVerifiableClaims(corpus).filter(
    (text) => !isCoveredByCallerClaim(text, callerClaims),
  );

  if (callerClaims.length === 0 && extractedClaims.length === 0 && !hasRawSources) {
    return { containsSyntheticMedia };
  }

  const hasVerifiedSupport = verifiedSourceIds.length > 0;
  const autoClaims: Record<string, unknown>[] = extractedClaims.map((text, idx) => ({
    id: `auto_claim_${idx + 1}`,
    text,
    riskLevel: 'high',
    sourceIds: hasVerifiedSupport ? verifiedSourceIds : [],
    status: hasVerifiedSupport ? 'supported' : 'pending',
  }));
  const mergedClaims = [...autoClaims, ...callerClaims];

  return {
    ...sourcesField,
    ...(mergedClaims.length > 0 ? { claims: mergedClaims } : {}),
    containsSyntheticMedia,
  };
}
