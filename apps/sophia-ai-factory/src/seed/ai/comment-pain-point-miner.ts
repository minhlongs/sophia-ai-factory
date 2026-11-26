/**
 * Zero-LLM Pre-Filter & Chunked Comment Pain-Point Miner.
 *
 * Clean-room primitive (MIT patterns from FrinterHero, reddit-complaint-miner,
 * reddit_signal, pain-miner): filters raw YouTube/Reddit comments locally for
 * buyer pain-points/objections and chunks them into bounded 20-comment batches
 * before dispatching to the customer's BYOK OpenRouter key (zero server ML COGS).
 *
 * Layer: seed/ai (pure deterministic filter & batcher)
 *
 * @module seed/ai/comment-pain-point-miner
 */

export interface RawSocialComment {
  readonly id: string;
  readonly text: string;
  readonly source: 'youtube' | 'reddit';
  readonly likes?: number;
}

export interface PainPointBatch {
  readonly batchIndex: number;
  readonly comments: readonly RawSocialComment[];
}

const PAIN_SIGNAL_REGEX =
  /\b(?:fee|fees|expensive|slow|bug|scam|locked|support|withdrawal|alternative|better than|hate|frustrated|stuck|phí cao|lỗi|chậm|hỗ trợ|rút tiền|thay thế)\b/i;

export function filterAndChunkPainComments(
  comments: readonly RawSocialComment[],
  chunkSize: number = 20,
): readonly PainPointBatch[] {
  const seenIds = new Set<string>();
  const filtered: RawSocialComment[] = [];

  for (const c of comments) {
    const clean = c.text.trim();
    if (!clean || clean.length < 15 || seenIds.has(c.id)) continue;
    if (!PAIN_SIGNAL_REGEX.test(clean)) continue;
    seenIds.add(c.id);
    filtered.push({ ...c, text: clean });
  }

  const safeSize = Math.max(1, Math.min(50, Math.round(chunkSize)));
  const batches: PainPointBatch[] = [];
  for (let i = 0; i < filtered.length; i += safeSize) {
    batches.push({
      batchIndex: batches.length,
      comments: filtered.slice(i, i + safeSize),
    });
  }
  return batches;
}
