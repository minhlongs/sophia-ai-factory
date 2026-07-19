/**
 * Algorithm: translate a script from one language to another using the
 * customer's own LLM key (BYOK). Delivers the homepage promise that
 * Sophia "translates scripts via your LLM key" — turned into a single
 * function call that the rest of the platform (REST API, Telegram bot,
 * OpenClaw bridge) can invoke without re-implementing the prompt or
 * the provider negotiation.
 *
 * BYOK resolution:
 *   1. Pull OpenRouter key from user_api_keys (BYOK store)
 *   2. If absent and BYOK_ENABLED=0, fall back to operator env key
 *   3. If still absent, throw `BYOK_REQUIRED` so callers can surface a
 *      friendly setup-wizard CTA to the user
 *
 * Doctrine: no operator credential is hard-required. Customer supplies key.
 *
 * @module land/i18n/translate-script
 */
import { resolveUserApiKey } from '@/tree/byok/resolve-user-api-key';
import { logger } from '@/seed/utils/logger-utility';
import { toError } from '@/seed/utils/to-error';
import { resilientChatCompletion } from '@/seed/inference/openrouter-client';

export interface TranslateScriptInput {
  userId: string;
  text: string;
  fromLang: string;       // ISO 639-1 ('en', 'vi', 'es' ...) or display ('English')
  toLang: string;
  /** Optional model override; defaults to a cheap, fast OpenRouter route. */
  model?: string;
  /** Tone hint: 'literal' preserves nuance, 'natural' allows light rephrase. */
  tone?: 'literal' | 'natural';
}

export interface TranslateScriptResult {
  translated: string;
  model: string;
  source: 'user' | 'platform' | 'unavailable';
  charsIn: number;
  charsOut: number;
}

export class TranslateConfigurationError extends Error {
  code: 'BYOK_REQUIRED' | 'BYOK_DISABLED' | 'EMPTY_TEXT';
  constructor(code: 'BYOK_REQUIRED' | 'BYOK_DISABLED' | 'EMPTY_TEXT', message: string) {
    super(message);
    this.name = 'TranslateConfigurationError';
    this.code = code;
  }
}

const DEFAULT_MODEL = 'meta-llama/llama-3.1-8b-instruct:free';
const MAX_INPUT_CHARS = 8000;

function buildPrompt(text: string, fromLang: string, toLang: string, tone: 'literal' | 'natural'): string {
  const toneInstr =
    tone === 'literal'
      ? 'Preserve nuance, punctuation, and line breaks exactly.'
      : 'Allow light rephrasing for natural target-language fluency, but keep the meaning.';
  return [
    `Translate the following text from ${fromLang} to ${toLang}.`,
    toneInstr,
    'Preserve markdown formatting and any product or brand names.',
    'Return ONLY the translated text with no preamble, no quotes, no explanation.',
    '',
    text,
  ].join('\n');
}

/**
 * Translate `input.text`. Pure compose around resilient client — returns a structured
 * result the caller can persist or render.
 */
export async function translateScript(
  input: TranslateScriptInput,
): Promise<TranslateScriptResult> {
  const text = input.text?.trim() ?? '';
  if (text.length === 0) {
    throw new TranslateConfigurationError('EMPTY_TEXT', 'Refusing to translate empty text');
  }
  // Soft cap so we never spend more than the user expected on a single call.
  const safeText = text.length > MAX_INPUT_CHARS ? text.slice(0, MAX_INPUT_CHARS) : text;

  const keyOrNull = await resolveUserApiKey(
    input.userId,
    'openrouter',
    process.env.OPENROUTER_API_KEY ?? undefined,
  );
  if (!keyOrNull) {
    throw new TranslateConfigurationError(
      'BYOK_REQUIRED',
      'Translate requires an OpenRouter key. Add yours in the Setup Wizard.',
    );
  }

  const model = input.model ?? DEFAULT_MODEL;
  const tone = input.tone ?? 'natural';
  const source: 'user' | 'platform' = process.env.OPENROUTER_API_KEY === keyOrNull ? 'platform' : 'user';

  try {
    const content = await resilientChatCompletion(
      buildPrompt(safeText, input.fromLang, input.toLang, tone),
      {
        openRouterKey: keyOrNull,
        anthropicKey: undefined,
        enableFallback: false,
        model,
      }
    );
    const translated = content.trim();
    if (translated.length === 0) {
      throw new Error('Translation provider returned empty body');
    }
    return {
      translated,
      model,
      source,
      charsIn: safeText.length,
      charsOut: translated.length,
    };
  } catch (err) {
    logger.error('[translate-script] failed', toError(err), { userId: input.userId, fromLang: input.fromLang, toLang: input.toLang });
    throw err;
  }
}
