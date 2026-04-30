/**
 * LLM Router — Qwen vs Claude tier routing
 * Phase 12: OpenClaw Orchestrator primitive
 *
 * Tier routing:
 *   lite     → Qwen 3 32B (localhost:11434) → fallback Claude Haiku
 *   standard → Qwen 3 32B → fallback Claude Haiku
 *   max      → Claude Sonnet/Opus directly
 *
 * Circuit breaker: KV-backed, resets after 60s, trips after 3 consecutive fails.
 */

export type LLMTier = 'lite' | 'standard' | 'max';

export interface LLMRouteOptions {
  /** Anthropic API key. Falls back to ANTHROPIC_API_KEY env var. */
  anthropicApiKey?: string;
  /** Override Qwen base URL. Defaults to QWEN_BASE_URL or http://localhost:11434 */
  qwenBaseUrl?: string;
  /** Request timeout ms for Qwen. Default 3000. */
  qwenTimeoutMs?: number;
  /** Model name for max tier. Default claude-sonnet-4-5. */
  maxModel?: string;
  /** Haiku model name. Default claude-haiku-3-5. */
  haikuModel?: string;
}

export interface LLMRouteResult {
  text: string;
  model: string;
  provider: 'qwen' | 'claude';
  tier: LLMTier;
}

// In-memory circuit breaker state.
// KNOWN LIMITATION: Cloudflare Workers isolates are ephemeral — state resets per cold-start
// and is NOT shared across replicas or regions. For durable circuit-breaker semantics,
// move _circuitState to KV (keyed by region or a global key).
// To disable the circuit breaker entirely (e.g. single-replica dev), set env var:
//   DISABLE_LLM_CIRCUIT_BREAKER=true
interface CircuitState {
  failures: number;
  openUntil: number; // epoch ms — 0 means closed
}

const _circuitState: CircuitState = { failures: 0, openUntil: 0 };
const CIRCUIT_FAILURE_THRESHOLD = 3;
const CIRCUIT_RESET_MS = 60_000;

function isCircuitOpen(): boolean {
  if (_circuitState.openUntil === 0) return false;
  if (Date.now() < _circuitState.openUntil) return true;
  // Auto-reset after window
  _circuitState.failures = 0;
  _circuitState.openUntil = 0;
  return false;
}

function recordQwenFailure(): void {
  _circuitState.failures += 1;
  if (_circuitState.failures >= CIRCUIT_FAILURE_THRESHOLD) {
    _circuitState.openUntil = Date.now() + CIRCUIT_RESET_MS;
  }
}

function recordQwenSuccess(): void {
  _circuitState.failures = 0;
  _circuitState.openUntil = 0;
}

/** Exported for testing */
export function _resetCircuit(): void {
  _circuitState.failures = 0;
  _circuitState.openUntil = 0;
}

export function _getCircuitState(): Readonly<CircuitState> {
  return { ..._circuitState };
}

async function callQwen(
  prompt: string,
  baseUrl: string,
  timeoutMs: number,
): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(`${baseUrl}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'qwen3:32b', prompt, stream: false }),
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!res.ok) throw new Error(`Qwen HTTP ${res.status}`);
    const data = await res.json() as { response?: string };
    return data.response ?? '';
  } finally {
    clearTimeout(timer);
  }
}

async function callClaude(
  prompt: string,
  model: string,
  apiKey: string,
): Promise<string> {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model,
      max_tokens: 4096,
      messages: [{ role: 'user', content: prompt }],
    }),
  });
  if (!res.ok) throw new Error(`Anthropic HTTP ${res.status}`);
  const data = await res.json() as { content?: { text?: string }[] };
  return data.content?.[0]?.text ?? '';
}

/**
 * Route an LLM call based on tier.
 */
export async function routeLLM(
  tier: LLMTier,
  prompt: string,
  opts: LLMRouteOptions = {},
): Promise<LLMRouteResult> {
  const qwenBaseUrl = opts.qwenBaseUrl ?? process.env.QWEN_BASE_URL ?? 'http://localhost:11434';
  const qwenTimeoutMs = opts.qwenTimeoutMs ?? 3_000;
  const apiKey = opts.anthropicApiKey ?? process.env.ANTHROPIC_API_KEY ?? '';
  const maxModel = opts.maxModel ?? 'claude-sonnet-4-5';
  const haikuModel = opts.haikuModel ?? 'claude-haiku-3-5';

  // max tier → Claude directly
  if (tier === 'max') {
    const text = await callClaude(prompt, maxModel, apiKey);
    return { text, model: maxModel, provider: 'claude', tier };
  }

  // lite / standard → try Qwen first (unless circuit open or disabled via env flag)
  const circuitEnabled = process.env.DISABLE_LLM_CIRCUIT_BREAKER !== 'true';
  if (!circuitEnabled || !isCircuitOpen()) {
    try {
      const text = await callQwen(prompt, qwenBaseUrl, qwenTimeoutMs);
      recordQwenSuccess();
      return { text, model: 'qwen3:32b', provider: 'qwen', tier };
    } catch {
      recordQwenFailure();
      // Fall through to Claude
    }
  }

  // Fallback: Claude Haiku
  const text = await callClaude(prompt, haikuModel, apiKey);
  return { text, model: haikuModel, provider: 'claude', tier };
}
