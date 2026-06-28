/**
 * Algorithm: generate an SEO-optimized video script using the caller's
 * BYOK OpenRouter key, then score the output for keyword coverage and
 * structural heuristics.
 *
 * Delivers the homepage promise "AI Script Generation — SEO-optimized"
 * by turning the prior hedge ("refine with your own prompts for SEO")
 * into a concrete scoring algorithm RaaS users invoke from REST API,
 * Telegram, or the OpenClaw bridge.
 *
 * The scorer is intentionally simple and explainable:
 *   - 60% weight on keyword coverage (each keyword appears ≥1× in body)
 *   - 20% weight on title containing the primary keyword
 *   - 10% weight on H2/H3 heading presence (markdown ## / ###)
 *   - 10% weight on word count landing inside the requested band
 *
 * Doctrine: no operator credential is hard-required. Customer supplies
 * their OpenRouter key via the Setup Wizard.
 *
 * @module land/scripts/generate-seo-script
 */
import { resolveUserApiKey } from '@/tree/byok/resolve-user-api-key';
import { logger } from '@/seed/utils/logger-utility';
import { toError } from '@/seed/utils/to-error';

export interface GenerateSeoScriptInput {
  userId: string;
  topic: string;
  keywords?: string[];
  language?: 'en' | 'vi';
  /** Target word count band, e.g. {min: 180, max: 260}. Defaults to 180–260. */
  lengthHint?: { min: number; max: number };
  /** Optional model override. */
  model?: string;
}

export interface GenerateSeoScriptResult {
  script: string;
  suggestedTitles: string[];
  seoScore: number;        // 0–100
  keywordCoverage: Array<{ keyword: string; hits: number }>;
  wordCount: number;
  model: string;
  source: 'user' | 'platform';
}

export class SeoScriptConfigurationError extends Error {
  code: 'BYOK_REQUIRED' | 'EMPTY_TOPIC';
  constructor(code: 'BYOK_REQUIRED' | 'EMPTY_TOPIC', message: string) {
    super(message);
    this.name = 'SeoScriptConfigurationError';
    this.code = code;
  }
}

const DEFAULT_MODEL = 'meta-llama/llama-3.1-8b-instruct:free';
const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';

function buildPrompt(
  topic: string,
  keywords: string[],
  language: 'en' | 'vi',
  min: number,
  max: number,
): string {
  const lang = language === 'vi' ? 'Vietnamese' : 'English';
  const kwLine = keywords.length > 0 ? `Target keywords (use each at least once): ${keywords.join(', ')}` : '';
  return [
    `Write a short ${lang}-language video script about: ${topic}.`,
    `Length: ${min}–${max} words.`,
    kwLine,
    'Format the script in markdown.',
    'Open with an `# H1` title line.',
    'Use `## H2` for at least two body sections.',
    'After the script, append exactly 3 short title alternatives, one per line, prefixed with `TITLE: `.',
    'Do not add any explanation outside of the script and TITLE lines.',
  ]
    .filter((s) => s.length > 0)
    .join('\n');
}

interface OpenRouterResponse {
  choices?: Array<{ message?: { content?: string } }>;
}

/**
 * Pure: count keyword hits in body (case-insensitive whole-word match).
 * Exported so unit tests can exercise it without the LLM call.
 */
export function countKeywordHits(body: string, keywords: string[]): Array<{ keyword: string; hits: number }> {
  const text = body.toLowerCase();
  return keywords.map((kw) => {
    const trimmed = kw.trim().toLowerCase();
    if (trimmed.length === 0) return { keyword: kw, hits: 0 };
    // Escape regex special chars in keyword.
    const safe = trimmed.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp(`(^|[^a-z0-9])${safe}([^a-z0-9]|$)`, 'g');
    const matches = text.match(re);
    return { keyword: kw, hits: matches?.length ?? 0 };
  });
}

interface ScoreInput {
  body: string;
  title: string;
  keywords: string[];
  primaryKeyword: string | null;
  wordCount: number;
  min: number;
  max: number;
}

/**
 * Pure: compute the SEO score. 0–100 scale. Returns score + coverage table.
 * Exported for unit-testing without LLM I/O.
 */
export function scoreSeo(input: ScoreInput): { score: number; coverage: Array<{ keyword: string; hits: number }> } {
  const coverage = countKeywordHits(input.body, input.keywords);
  const covered = coverage.filter((c) => c.hits > 0).length;
  const coverageRatio = input.keywords.length > 0 ? covered / input.keywords.length : 1;

  const primaryInTitle =
    input.primaryKeyword && input.title.toLowerCase().includes(input.primaryKeyword.toLowerCase()) ? 1 : 0;

  const headingHits = (input.body.match(/^##+\s/gm) ?? []).length;
  const headingFactor = headingHits >= 2 ? 1 : headingHits === 1 ? 0.5 : 0;

  const lenFactor =
    input.wordCount >= input.min && input.wordCount <= input.max
      ? 1
      : input.wordCount < input.min
        ? input.wordCount / input.min
        : input.max / input.wordCount;

  const score = Math.round(
    60 * coverageRatio + 20 * primaryInTitle + 10 * headingFactor + 10 * Math.max(0, Math.min(1, lenFactor)),
  );
  return { score, coverage };
}

/**
 * Split the LLM output into script + titles. Defensive against missing
 * TITLE: lines and against extra preamble.
 */
function splitScriptAndTitles(raw: string): { script: string; titles: string[] } {
  const lines = raw.split('\n');
  const titles: string[] = [];
  const scriptLines: string[] = [];
  for (const line of lines) {
    const m = /^TITLE:\s*(.+)$/.exec(line.trim());
    if (m) {
      titles.push(m[1].trim());
    } else {
      scriptLines.push(line);
    }
  }
  return { script: scriptLines.join('\n').trim(), titles };
}

function extractH1(script: string): string {
  const m = /^#\s+(.+)$/m.exec(script);
  return m ? m[1].trim() : '';
}

export async function generateSeoScript(
  input: GenerateSeoScriptInput,
): Promise<GenerateSeoScriptResult> {
  const topic = input.topic?.trim() ?? '';
  if (topic.length === 0) {
    throw new SeoScriptConfigurationError('EMPTY_TOPIC', 'topic is required');
  }
  const keywords = (input.keywords ?? []).map((k) => k.trim()).filter((k) => k.length > 0);
  const language = input.language ?? 'en';
  const min = input.lengthHint?.min ?? 180;
  const max = input.lengthHint?.max ?? 260;

  const keyOrNull = await resolveUserApiKey(
    input.userId,
    'openrouter',
    process.env.OPENROUTER_API_KEY ?? undefined,
  );
  if (!keyOrNull) {
    throw new SeoScriptConfigurationError(
      'BYOK_REQUIRED',
      'Script generation requires an OpenRouter key. Add yours in the Setup Wizard.',
    );
  }
  const source: 'user' | 'platform' = process.env.OPENROUTER_API_KEY === keyOrNull ? 'platform' : 'user';
  const model = input.model ?? DEFAULT_MODEL;

  try {
    const res = await fetch(OPENROUTER_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${keyOrNull}`,
        'Content-Type': 'application/json',
        'X-Title': 'Sophia generate-seo-script',
      },
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: buildPrompt(topic, keywords, language, min, max) }],
        temperature: 0.5,
        max_tokens: 1200,
      }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      logger.warn('[generate-seo-script] OpenRouter non-2xx', { status: res.status, body: body.slice(0, 200) });
      throw new Error(`LLM provider returned ${res.status}`);
    }
    const json = (await res.json()) as OpenRouterResponse;
    const raw = json.choices?.[0]?.message?.content?.trim() ?? '';
    if (raw.length === 0) {
      throw new Error('LLM provider returned empty body');
    }

    const { script, titles } = splitScriptAndTitles(raw);
    const title = extractH1(script);
    const wordCount = script.split(/\s+/).filter(Boolean).length;
    const primary = keywords[0] ?? null;
    const { score, coverage } = scoreSeo({
      body: script,
      title,
      keywords,
      primaryKeyword: primary,
      wordCount,
      min,
      max,
    });

    return {
      script,
      suggestedTitles: titles,
      seoScore: score,
      keywordCoverage: coverage,
      wordCount,
      model,
      source,
    };
  } catch (err) {
    logger.error('[generate-seo-script] failed', toError(err), { userId: input.userId, topic });
    throw err;
  }
}
