import { getD1 } from "@/seed/db/client";
import { randomBase32 } from "@/seed/utils/random-base32";
import { getCodeByCode } from "../promo-repo";

export const SUFFIX_LEN = 8;
export const COLLISION_RETRY_BUDGET = 3;

export function randomHexId(bytes: number): string {
  const arr = crypto.getRandomValues(new Uint8Array(bytes));
  return Array.from(arr, (b) => b.toString(16).padStart(2, "0")).join("");
}

export function makeCandidates(baseCode: string, count: number): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  while (out.length < count) {
    const c = `${baseCode}-${randomBase32(SUFFIX_LEN)}`;
    if (seen.has(c)) continue; // intra-batch dedup (extremely rare at 40-bit entropy)
    seen.add(c);
    out.push(c);
  }
  return out;
}

/**
 * Returns the set of `codes` that already exist in promo_codes.
 * Falls back to per-code lookup if the IN-clause is unsupported in test env.
 */
export async function findExistingCodes(codes: string[]): Promise<Set<string>> {
  if (codes.length === 0) return new Set();
  const _db = await getD1();
  if (!_db) throw new Error('D1 database binding not available');
  const db = _db;
  try {
    const placeholders = codes.map((_, i) => `?${i + 1}`).join(",");
    const stmt = db
      .prepare(`SELECT code FROM promo_codes WHERE code IN (${placeholders})`)
      .bind(...codes);
    const result = await stmt.all<{ code: string }>();
    const rows = result.results ?? [];
    return new Set(rows.map((r) => r.code));
  } catch {
    // Fallback for environments without IN-clause support (mocked tests)
    const hits = new Set<string>();
    for (const c of codes) {
      const row = await getCodeByCode(c);
      if (row) hits.add(c);
    }
    return hits;
  }
}

/**
 * Generate N unique codes. Uses a single SELECT WHERE code IN (?, ?, ...) to detect
 * collisions in one round-trip. If any collide, regenerate just those and re-check
 * (up to COLLISION_RETRY_BUDGET passes total).
 */
export async function generateUniqueCodes(
  baseCode: string,
  count: number,
): Promise<string[]> {
  let candidates: string[] = makeCandidates(baseCode, count);
  for (let pass = 0; pass < COLLISION_RETRY_BUDGET; pass++) {
    const collisions = await findExistingCodes(candidates);
    if (collisions.size === 0) return candidates;
    // Replace collided positions with fresh candidates and retry
    candidates = candidates.map((c) =>
      collisions.has(c) ? `${baseCode}-${randomBase32(SUFFIX_LEN)}` : c,
    );
  }
  // Final check after last regeneration
  const finalCollisions = await findExistingCodes(candidates);
  if (finalCollisions.size > 0) {
    throw new Error(
      `collision retry exhausted (${COLLISION_RETRY_BUDGET} passes); ${finalCollisions.size} unresolvable collisions`,
    );
  }
  return candidates;
}

export function buildCsv(
  codes: string[],
  tier: string,
  validUntil: number | undefined,
  description: string,
): string {
  const escape = (s: string | number) => `"${String(s).replaceAll('"', '""')}"`;
  const header = ["code", "tier", "valid_until_unix", "description"]
    .map(escape)
    .join(",");
  const rows = codes.map((c) =>
    [c, tier, validUntil ?? "", description].map(escape).join(","),
  );
  return [header, ...rows].join("\n");
}
