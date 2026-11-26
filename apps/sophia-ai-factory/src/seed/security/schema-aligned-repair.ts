/**
 * Deterministic Schema-Aligned Parsing (SAP) & JSON Transport Repair.
 *
 * Clean-room primitive inspired by typed agent parsing patterns:
 * repairs common LLM formatting drift (markdown code fences, prose wrappers,
 * trailing commas) before strict Zod validation — without weakening the Zod
 * schema — so customer BYOK OpenRouter credits are not wasted on avoidable retries.
 *
 * Layer: seed/security (pure function, zero external deps)
 *
 * @module seed/security/schema-aligned-repair
 */

export interface JsonRepairResult {
  readonly ok: boolean;
  readonly parsed: unknown;
  readonly repaired: boolean;
  readonly error?: string;
}

function stripMarkdownFences(raw: string): string {
  const fenced = raw.match(/```(?:json|JSON)?\s*([\s\S]*?)```/);
  if (fenced?.[1]) {
    return fenced[1].trim();
  }
  return raw.trim();
}

function extractBalancedJsonSlice(text: string): string {
  const firstObj = text.indexOf('{');
  const firstArr = text.indexOf('[');
  let start = -1;
  let openChar = '{';
  let closeChar = '}';

  if (firstObj !== -1 && (firstArr === -1 || firstObj < firstArr)) {
    start = firstObj;
    openChar = '{';
    closeChar = '}';
  } else if (firstArr !== -1) {
    start = firstArr;
    openChar = '[';
    closeChar = ']';
  }

  if (start === -1) return text;
  const end = text.lastIndexOf(closeChar);
  if (end === -1 || end < start) return text;
  if (text[start] !== openChar) return text;
  return text.slice(start, end + 1);
}

function removeTrailingCommas(jsonText: string): string {
  return jsonText.replace(/,\s*([}\]])/g, '$1');
}

export function parseLlmJsonWithRepair(rawOutput: string): JsonRepairResult {
  const trimmed = rawOutput.trim();
  if (!trimmed) {
    return { ok: false, parsed: null, repaired: false, error: 'EMPTY_LLM_OUTPUT' };
  }

  try {
    return { ok: true, parsed: JSON.parse(trimmed), repaired: false };
  } catch {
    // Fall through to deterministic transport repair
  }

  const candidate = removeTrailingCommas(extractBalancedJsonSlice(stripMarkdownFences(trimmed)));
  try {
    return { ok: true, parsed: JSON.parse(candidate), repaired: true };
  } catch (err) {
    return {
      ok: false,
      parsed: null,
      repaired: false,
      error: err instanceof Error ? err.message : 'JSON_PARSE_FAILED',
    };
  }
}
