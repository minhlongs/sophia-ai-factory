/**
 * @module seed/ai/provider-scoring
 *
 * 7-dimension provider scoring engine ported from OpenMontage.
 *
 * Scores AI providers against a task context using weighted multi-dimensional
 * evaluation: task_fit, output_quality, control, reliability, cost_efficiency,
 * latency, and continuity. Uses synonym expansion for semantic matching and
 * overlap coefficient (not Jaccard) for keyword overlap.
 *
 * Cloudflare Workers compatible — no Node.js APIs.
 *
 * Layer rule: seed only — imports from seed/ utilities exclusively.
 */

import type { Logger } from '@/seed/utils/logger-utility';
import { createLogger } from '@/seed/utils/logger-utility';

const logger = createLogger('seed/ai/provider-scoring');

// ── Synonym clusters for semantic matching ────────────────────────────────────
// When intent says "cinematic" and a tool says "film", that is a match
// even without literal keyword overlap. Each set is a synonym cluster.

const SYNONYM_CLUSTERS: ReadonlyArray<ReadonlySet<string>> = [
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

// ── Public types ──────────────────────────────────────────────────────────────

/**
 * Scored evaluation of a single provider against a task context.
 *
 * All dimension scores are normalised 0-1 (higher is better).
 * `weighted_score` is computed from the dimension weights at access time.
 */
export interface ProviderScore {
  /** Provider identifier (e.g. "openrouter", "anthropic", "wan"). */
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

// ── Internal helpers ──────────────────────────────────────────────────────────

/** Regex matching lowercase alphanumeric tokens with common punctuation. */
const TOKEN_RE = /[a-z0-9]+(?:[a-z0-9+._]*)/g;

/**
 * Tokenise a string into lowercase tokens.
 */
function tokenizeText(value: string): string[] {
  return value.toLowerCase().match(TOKEN_RE) ?? [];
}

/**
 * Expand a word set with synonyms from known clusters.
 *
 * If any word in the input set belongs to a cluster, the entire cluster
 * is added. This enables semantic matching (e.g. "cinematic" matches "film").
 */
function expandSynonyms(words: Set<string>): Set<string> {
  const expanded = new Set(words);
  for (const cluster of SYNONYM_CLUSTERS) {
    if ([...expanded].some((w) => cluster.has(w))) {
      cluster.forEach((syn) => expanded.add(syn));
    }
  }
  return expanded;
}

/**
 * Overlap coefficient between two keyword sets.
 *
 * Uses |A intersect B| / min(|A|, |B|) rather than Jaccard.
 * Jaccard over-penalises tools whose best_for describes many strengths —
 * a premium provider with seven rich bullets gets a smaller Jaccard than
 * a narrowly-scoped provider with one bullet, even when the premium provider
 * fully covers the intent. Overlap coefficient answers the relevant question:
 * "is the intent a subset of what this tool advertises?"
 */
export function keywordOverlap(setA: Set<string>, setB: Set<string>): number {
  if (setA.size === 0 || setB.size === 0) return 0;
  const lowerA = new Set([...setA].map((s) => s.toLowerCase().trim()));
  const lowerB = new Set([...setB].map((s) => s.toLowerCase().trim()));
  const intersection = [...lowerA].filter((x) => lowerB.has(x)).length;
  const smaller = Math.min(lowerA.size, lowerB.size);
  return smaller > 0 ? intersection / smaller : 0;
}

// ── Per-dimension scorers ─────────────────────────────────────────────────────

/**
 * Score how well a tool's best_for matches the task intent and style.
 *
 * Uses synonym expansion and real tokenisation so that semantic near-misses
 * (e.g. "cinematic" vs "film") and punctuation-adjacent tokens
 * (e.g. "trailers," vs "trailer") still score well.
 */
function computeTaskFit(
  bestFor: Set<string>,
  intent: string,
  styleKeywords: Set<string>,
): number {
  if (bestFor.size === 0) return 0.3; // Unknown capability — modest default

  const intentWords = expandSynonyms(
    new Set(tokenizeText(intent)),
  );
  const bestForWords = expandSynonyms(
    new Set([...bestFor].flatMap((desc) => tokenizeText(desc))),
  );

  const intentScore = keywordOverlap(intentWords, bestForWords);
  const styleExpanded = expandSynonyms(
    new Set([...styleKeywords].map((kw) => kw.toLowerCase())),
  );
  const styleScore = keywordOverlap(styleExpanded, bestForWords);

  return Math.min(1.0, intentScore * 0.7 + styleScore * 0.3 + 0.1);
}

/**
 * Score controllability from the supports dict.
 *
 * Features are weighted by creative impact — controlnet and reference_image
 * are worth more than seed or aspect_ratio.
 */
function computeControl(supports: Readonly<Record<string, boolean>>): number {
  const controlFeatures: readonly [string, number][] = [
    ['controlnet', 2.0],
    ['reference_image', 1.8],
    ['style_transfer', 1.5],
    ['inpainting', 1.5],
    ['img2img', 1.3],
    ['negative_prompt', 1.0],
    ['custom_size', 0.8],
    ['aspect_ratio', 0.7],
    ['seed', 0.5],
  ];

  if (!supports || Object.keys(supports).length === 0) return 0.3;

  const totalWeight = controlFeatures.reduce((sum, [, w]) => sum + w, 0);
  const earned = controlFeatures
    .filter(([feature]) => supports[feature])
    .reduce((sum, [, w]) => sum + w, 0);

  return Math.min(1.0, earned / (totalWeight * 0.5));
}

/**
 * Score cost efficiency. Free is 1.0, over-budget is 0.0.
 */
function computeCostEfficiency(
  estimatedCost: number,
  budgetRemaining: number | undefined,
): number {
  if (estimatedCost <= 0) return 1.0;
  if (budgetRemaining !== undefined && budgetRemaining <= 0) return 0.0;

  if (budgetRemaining !== undefined) {
    const ratio = estimatedCost / budgetRemaining;
    if (ratio > 0.5) return 0.1;
    if (ratio > 0.2) return 0.5;
    return 0.8;
  }

  // No budget info — use absolute cost heuristic
  if (estimatedCost < 0.05) return 0.9;
  if (estimatedCost < 0.20) return 0.7;
  if (estimatedCost < 1.00) return 0.5;
  return 0.3;
}

/**
 * Score how well this provider fits already-locked decisions.
 */
function computeContinuity(
  provider: string,
  lockedProviders: readonly string[],
): number {
  if (lockedProviders.length === 0) return 0.5; // No prior context
  return lockedProviders.includes(provider) ? 0.9 : 0.4;
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Score a single provider against a task context.
 *
 * Returns a ProviderScore with all 7 dimensions and the computed
 * weighted composite. All scores are normalised 0-1.
 *
 * @param tool - Provider metadata implementing ToolInfo.
 * @param taskContext - Task description and constraints.
 * @returns ProviderScore with all dimensions populated.
 */
export function scoreProvider(
  tool: ToolInfo,
  taskContext: TaskContext,
): ProviderScore {
  logger.debug('Scoring provider', {
    provider: tool.provider,
    toolName: tool.name,
  });

  // Build effective best_for set
  const bestFor = new Set(tool.bestFor ?? []);
  const intent = taskContext.intent ?? '';
  const styleKeywords = new Set(taskContext.styleKeywords ?? []);

  // Expand style keywords from style/platform/needs strings
  for (const source of [
    taskContext.style,
    taskContext.platform,
    ...(taskContext.needs ?? []),
  ]) {
    if (typeof source === 'string') {
      tokenizeText(source).forEach((tok) => styleKeywords.add(tok));
    }
  }

  // ── task_fit ───────────────────────────────────────────────────────────
  let taskFit = computeTaskFit(bestFor, intent, styleKeywords);

  // ── reliability ────────────────────────────────────────────────────────
  const histSuccess = tool.historicalSuccessRate;
  const statusValue = tool.stability ?? 'experimental';
  let reliability: number;
  if (histSuccess !== undefined) {
    reliability = histSuccess;
  } else if (statusValue === 'production') {
    reliability = 0.95;
  } else if (statusValue === 'beta') {
    reliability = 0.8;
  } else {
    reliability = 0.4; // experimental
  }

  // ── control ────────────────────────────────────────────────────────────
  let control = computeControl(tool.supports ?? {});

  // ── cost_efficiency ────────────────────────────────────────────────────
  let estimatedCost = 0;
  if (tool.estimateCost) {
    try {
      estimatedCost = tool.estimateCost(taskContext);
    } catch {
      // Cost estimation failed — treat as free
    }
  }
  const costEfficiency = computeCostEfficiency(
    estimatedCost,
    taskContext.budgetRemainingUsd,
  );

  // ── latency ────────────────────────────────────────────────────────────
  const measuredP50 = tool.latencyP50Seconds;
  let latency: number;
  if (measuredP50 !== undefined) {
    if (measuredP50 <= 1.0) latency = 1.0;
    else if (measuredP50 <= 10.0) latency = 0.8;
    else if (measuredP50 <= 30.0) latency = 0.6;
    else if (measuredP50 <= 60.0) latency = 0.4;
    else latency = 0.2;
  } else {
    const runtime = tool.runtime ?? 'api';
    if (runtime === 'local' || runtime === 'local_gpu') latency = 0.9;
    else if (runtime === 'hybrid') latency = 0.6;
    else latency = 0.4;
  }

  // ── continuity ─────────────────────────────────────────────────────────
  const continuity = computeContinuity(
    tool.provider,
    taskContext.lockedProviders ?? [],
  );

  // ── output_quality ─────────────────────────────────────────────────────
  const measuredQuality = tool.qualityScore;
  let outputQuality: number;
  if (measuredQuality !== undefined) {
    outputQuality = measuredQuality;
  } else {
    const qualityMap: Record<string, number> = {
      production: 0.9,
      beta: 0.7,
      experimental: 0.4,
    };
    outputQuality = qualityMap[statusValue] ?? 0.5;
    // Tier bonus: generate-tier tools that are production-stable get a nudge
    if (tool.tier === 'generate' && statusValue === 'production') {
      outputQuality = Math.min(1.0, outputQuality + 0.05);
    }
  }

  // ── Contextual adjustments ─────────────────────────────────────────────

  const assetType = taskContext.assetType;

  // Motion-required penalty: if task needs motion but tool is image-only
  if (
    taskContext.motionRequired &&
    assetType === 'video' &&
    !(tool.capability ?? '').includes('video')
  ) {
    taskFit *= 0.2; // Heavy penalty
  }

  // Stock-like provider penalty for generated-visual preferences
  const isStockLike = ['pexels', 'pixabay'].includes(
    tool.provider.toLowerCase(),
  );
  const stockKeywords = new Set(['stock', 'footage', 'b-roll', 'library']);
  const bestForTokens = new Set(
    [...bestFor].flatMap((d) => tokenizeText(d)),
  );
  const prefersGenerated =
    taskContext.intent !== undefined &&
    expandSynonyms(new Set(tokenizeText(taskContext.intent))).size > 0 &&
    [...expandSynonyms(new Set(tokenizeText(taskContext.intent)))].some((w) =>
      stockKeywords.has(w),
    ) === false;

  if (
    taskContext.intent !== undefined &&
    isStockLike &&
    (assetType === 'video' || assetType === 'image')
  ) {
    // Check if intent contains generated-visual terms
    const generatedVisualTerms = new Set([
      'animated',
      'animation',
      'anime',
      'cartoon',
      'character',
      'cinematic',
      'concept',
      'fantasy',
      'ghibli',
      'illustration',
      'pixar',
      'render',
      'scifi',
      'short',
      'story',
      'stylized',
      'surreal',
    ]);
    const intentTokens = new Set(tokenizeText(intent));
    const hasGeneratedVisual = [...intentTokens].some((t) =>
      generatedVisualTerms.has(t),
    );
    if (hasGeneratedVisual) {
      taskFit *= 0.55;
      outputQuality *= 0.85;
    }
  }

  // Reference conditioning bonus/penalty
  const wantsReference =
    taskContext.operation === 'reference_to_video' ||
    (taskContext.intent !== undefined &&
      ['character', 'consistency', 'identity', 'preserve', 'product', 'reference', 'subject', 'wardrobe'].some((term) =>
        tokenizeText(intent).includes(term),
      ));

  if (wantsReference && assetType === 'video') {
    const refSupport =
      tool.supports?.reference_to_video ||
      tool.supports?.reference_image ||
      tool.supports?.multiple_reference_images;
    if (refSupport) {
      taskFit = Math.min(1.0, taskFit + 0.18);
      control = Math.min(1.0, control + 0.12);
    } else {
      taskFit *= 0.7;
    }
  }

  // Image editing bonus/penalty
  const wantsImageEdit =
    taskContext.operation === 'edit' ||
    (taskContext.intent !== undefined &&
      ['combine', 'composite', 'edit', 'merge', 'modify', 'repaint', 'replace', 'style-transfer', 'transfer'].some((term) =>
        tokenizeText(intent).includes(term),
      ));

  if (wantsImageEdit && assetType === 'image') {
    const editSupport =
      tool.supports?.image_edit ||
      tool.supports?.style_transfer ||
      tool.supports?.multiple_reference_images;
    if (editSupport) {
      taskFit = Math.min(1.0, taskFit + 0.18);
      control = Math.min(1.0, control + 0.10);
    } else {
      taskFit *= 0.7;
    }
  }

  // Premium-cinematic bonus for video tasks with cinematic intent
  if (assetType === 'video') {
    const cinematicSignal =
      intent !== undefined &&
      [...expandSynonyms(new Set(tokenizeText(intent))), ...styleKeywords].some(
        (w) =>
          ['cinematic', 'film', 'movie', 'trailer', 'teaser', 'dramatic', 'epic', 'premium'].includes(
            w,
          ),
      );

    if (cinematicSignal) {
      const premiumFeatures = [
        tool.supports?.native_audio,
        tool.supports?.multi_shot,
        tool.supports?.camera_direction,
        tool.supports?.lip_sync,
        tool.supports?.cinematic_quality,
      ];
      const matched = premiumFeatures.filter(Boolean).length;
      if (matched >= 3) {
        taskFit = Math.min(1.0, taskFit + 0.15);
        outputQuality = Math.min(1.0, outputQuality + 0.10);
      } else if (matched >= 1) {
        taskFit = Math.min(1.0, taskFit + 0.05);
      }
    }
  }

  // Clamp all dimensions to [0, 1]
  const finalTaskFit = Math.min(1.0, Math.max(0, taskFit));

  const weightedScore =
    finalTaskFit * DIMENSION_WEIGHTS.task_fit +
    outputQuality * DIMENSION_WEIGHTS.output_quality +
    control * DIMENSION_WEIGHTS.control +
    reliability * DIMENSION_WEIGHTS.reliability +
    costEfficiency * DIMENSION_WEIGHTS.cost_efficiency +
    latency * DIMENSION_WEIGHTS.latency +
    continuity * DIMENSION_WEIGHTS.continuity;

  logger.debug('Provider scored', {
    provider: tool.provider,
    toolName: tool.name,
    weightedScore: weightedScore.toFixed(3),
    taskFit: finalTaskFit.toFixed(2),
    outputQuality: outputQuality.toFixed(2),
    control: control.toFixed(2),
    reliability: reliability.toFixed(2),
  });

  return {
    provider: tool.provider,
    toolName: tool.name,
    task_fit: finalTaskFit,
    output_quality: outputQuality,
    control,
    reliability,
    cost_efficiency: costEfficiency,
    latency,
    continuity,
    weighted_score: weightedScore,
  };
}

/**
 * Rank a list of tools by weighted score for a given task context.
 *
 * Returns scores sorted best-first (highest weighted_score first).
 *
 * @param tools - Array of provider metadata implementing ToolInfo.
 * @param taskContext - Task description and constraints.
 * @returns ProviderScore[] sorted by weighted_score descending.
 */
export function rankProviders(
  tools: readonly ToolInfo[],
  taskContext: TaskContext,
): ProviderScore[] {
  const scores = tools.map((tool) => scoreProvider(tool, taskContext));
  return scores.sort((a, b) => b.weighted_score - a.weighted_score);
}

/**
 * Format a ranking list for user presentation.
 *
 * Shows the top N entries with score and key dimension highlights.
 *
 * @param rankings - ProviderScore array (typically from rankProviders).
 * @param topN - Maximum entries to include (default 5).
 * @returns Human-readable formatted string.
 */
export function formatRanking(
  rankings: readonly ProviderScore[],
  topN = 5,
): string {
  const lines: string[] = [];
  for (let i = 0; i < Math.min(topN, rankings.length); i++) {
    const r = rankings[i]!;
    lines.push(
      `  ${i + 1}. ${r.toolName} (${r.provider}) — ` +
        `score: ${r.weighted_score.toFixed(2)} ` +
        `[fit=${r.task_fit.toFixed(1)} quality=${r.output_quality.toFixed(1)} ` +
        `control=${r.control.toFixed(1)} reliable=${r.reliability.toFixed(1)} ` +
        `cost=${r.cost_efficiency.toFixed(1)}]`,
    );
  }
  return lines.join('\n');
}
