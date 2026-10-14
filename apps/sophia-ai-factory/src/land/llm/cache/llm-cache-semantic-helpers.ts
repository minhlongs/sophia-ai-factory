import type { CacheKey } from './llm-cache'

export const EMBEDDING_MODEL_ID = '@cf/baai/bge-base-en-v1.5'
const EMBED_TIMEOUT_MS = 5000

export interface AiRunResult {
  data?: number[][]
}

export interface AiBinding {
  run: (model: string, input: { text: string | string[] }) => Promise<AiRunResult>
}

export interface CandidateRow {
  hash:          string
  response:      string
  input_tokens:  number | null
  output_tokens: number | null
  cost_usd:      number | null
  expires_at:    string
  embedding:     ArrayBuffer | Uint8Array | null
}

export function getAiBinding(): AiBinding | null {
  const binding = (globalThis as unknown as { AI?: AiBinding }).AI
  return binding && typeof binding.run === 'function' ? binding : null
}

/**
 * Concatenate user-role message content into a single embeddable string.
 * Caller order preserved — rephrasing a single message still hits.
 */
export function normalizePromptForEmbedding(messages: CacheKey['messages']): string {
  return messages
    .filter((m) => m.role === 'user')
    .map((m) => m.content)
    .join('\n\n')
    .slice(0, 8192)  // bge-base max context ≈ 512 tokens; hard-cap chars
}

export async function embedPrompt(text: string): Promise<Float32Array | null> {
  const ai = getAiBinding()
  if (!ai) return null
  if (!text.trim()) return null
  try {
    // Timeout guard (M-1): AI binding call must not block writeCache indefinitely.
    // 5s is well above p99 latency (~80ms) — trips only on hard infra issues.
    const embedResult = Promise.race([
      ai.run(EMBEDDING_MODEL_ID, { text }),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('EMBED_TIMEOUT')), EMBED_TIMEOUT_MS),
      ),
    ])
    const result = await embedResult as AiRunResult
    const vec = result.data?.[0]
    if (!Array.isArray(vec) || vec.length === 0) return null
    return Float32Array.from(vec)
  } catch {
    return null
  }
}

/**
 * Cosine similarity for L2-unnormalized vectors. Returns value in [-1, 1].
 * Returns 0 when either vector has zero magnitude or lengths differ.
 */
export function cosineSimilarity(a: Float32Array, b: Float32Array): number {
  if (a.length !== b.length || a.length === 0) return 0
  let dot = 0, aMag = 0, bMag = 0
  for (let i = 0; i < a.length; i++) {
    dot  += a[i] * b[i]
    aMag += a[i] * a[i]
    bMag += b[i] * b[i]
  }
  if (aMag === 0 || bMag === 0) return 0
  return dot / (Math.sqrt(aMag) * Math.sqrt(bMag))
}

export function encodeEmbedding(vec: Float32Array): Uint8Array {
  return new Uint8Array(vec.buffer, vec.byteOffset, vec.byteLength)
}

export function decodeEmbedding(bytes: ArrayBuffer | Uint8Array): Float32Array {
  const buf = bytes instanceof Uint8Array
    ? bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)
    : bytes
  return new Float32Array(buf)
}
