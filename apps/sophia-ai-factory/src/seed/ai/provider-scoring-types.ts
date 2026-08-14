/**
 * @module seed/ai/provider-scoring-types
 *
 * Types and constants for the 7-dimension provider scoring engine.
 *
 * Cloudflare Workers compatible — no Node.js APIs.
 * Layer rule: seed only — imports from seed/ utilities exclusively.
 */

// ── Synonym clusters for semantic matching ────────────────────────────────────
// When intent says "cinematic" and a tool says "film", that is a match
// even without literal keyword overlap. Each set is a synonym cluster.

export const SYNONYM_CLUSTERS: ReadonlyArray<ReadonlySet<string>> = [
  new Set(['cinematic', 'film', 'movie', 'trailer', 'dramatic', 'epic']),
  new Set(['explainer', 'educational', 'tutorial', 'teaching', 'lesson']),
  new Set(['social', 'tiktok', 'instagram', 'reels', 'shorts', 'viral']),
  new Set(['animation', 'animated', 'motion-graphics', 'motion', 'kinetic']),
  new Set(['avatar', 'presenter', 'talking-head', 'spokesperson']),
  new Set(['voiceover', 'narration', 'speech', 'voice']),
  new Set(['music', 'soundtrack', 'background-music', 'score', 'ambient']),
] as const;

// ── Dimension weights ─────────────────────────────────────────────────────────
// task_fit * 0.30 + output_quality * 0.20 + control * 0.15 +
// reliability * 0.15 + cost_efficiency * 0.10 + latency * 0.05 +
// continuity * 0.05

export const DIMENSION_WEIGHTS = {
  task_fit: 0.30,
  output_quality: 0.20,
  control: 0.15,
  reliability: 0.15,
  cost_efficiency: 0.10,
  latency: 0.05,
  continuity: 0.05,
} as const;

// ── Types ─────────────────────────────────────────────────────────────────────

/**
 * Scored evaluation of a single provider against a task context.
 *
 * All dimension scores are normalised 0-1 (higher is better).
 * `weighted_score` is computed from the dimension weights at access time.
 */
export interface ProviderScore {
  /** Provider identifier (e.g. "openrouter", "nhà cung cấp dịch vụ AI", "wan"). */
  readonly provider: string;
  /** Human-readable provider or model name. */
  readonly toolName: string;
  /** How well this provider fits the specific task intent and style. */
  readonly task_fit: number;
  /** Expected output fidelity for the brief. */
  readonly output_quality: number;
  /** Reference/style directability (controlnet, img2img, etc.). */
  readonly control: number;
  /** Runtime confidence based on status and historical success rate. */
  readonly reliability: number;
  /** Quality-per-dollar: higher when cost is low relative to budget. */
  readonly cost_efficiency: number;
  /** Acceptable turnaround: higher for fast providers. */
  readonly latency: number;
  /** Fits already-locked decisions (same provider as prior steps). */
  readonly continuity: number;
  /** Weighted composite score (0-1). Computed from dimension values. */
  readonly weighted_score: number;
}

/**
 * Task context passed to the scoring engine.
 *
 * Provide as much as is known; missing fields get sensible defaults.
 */
export interface TaskContext {
  /** What the asset is for — the primary intent description. */
  readonly intent?: string;
  /** Visual or audio style descriptors. */
  readonly styleKeywords?: readonly string[];
  /** Additional needs or requirements (expanded into intent). */
  readonly needs?: readonly string[];
  /** Style string (expanded into styleKeywords). */
  readonly style?: string;
  /** Brief or goal description (expanded into intent). */
  readonly brief?: string;
  /** Goal string (expanded into intent). */
  readonly goal?: string;
  /** Target platform (expanded into styleKeywords). */
  readonly platform?: string;
  /** Remaining budget in USD. */
  readonly budgetRemainingUsd?: number;
  /** Providers already chosen for prior steps (continuity signal). */
  readonly lockedProviders?: readonly string[];
  /** Whether motion is a hard requirement (penalises image-only tools). */
  readonly motionRequired?: boolean;
  /** Asset type: "image" | "video" | "audio" | "music" | "voice". */
  readonly assetType?: string;
  /** Operation type (e.g. "reference_to_video", "edit"). */
  readonly operation?: string;
}

/**
 * Static tool metadata consumed by the scoring engine.
 *
 * Implement this interface on your tool/provider wrapper classes.
 * The scoring engine reads these fields only — no network calls.
 */
export interface ToolInfo {
  /** Stable provider identifier (e.g. "openrouter", "anthropic", "wan"). */
  readonly provider: string;
  /** Human-readable name for display and logging. */
  readonly name: string;
  /** Stability tier: "production" | "beta" | "experimental". */
  readonly stability?: string;
  /** Runtime class: "api" | "local" | "local_gpu" | "hybrid". */
  readonly runtime?: string;
  /** What this tool is best at — used for task-fit scoring. */
  readonly bestFor?: readonly string[];
  /** Feature support flags — used for control scoring. */
  readonly supports?: Readonly<Record<string, boolean>>;
  /** Historical success rate 0-1, if tracked. */
  readonly historicalSuccessRate?: number;
  /** Measured p50 latency in seconds, if available. */
  readonly latencyP50Seconds?: number;
  /** Measured quality score 0-1, if available. */
  readonly qualityScore?: number;
  /** Capability string for motion-required penalty (e.g. "video_generation"). */
  readonly capability?: string;
  /** Tier string for quality bonus ("generate" gets a nudge). */
  readonly tier?: string;
  /** Optional cost estimator — returns estimated USD for the task context. */
  estimateCost?: (context: TaskContext) => number;
}
