/**
 * Configuration constants for A/B Winner Picker
 */

/** Minimum impressions PER VARIANT before statistical test is valid. */
export const MIN_IMPRESSIONS_PER_VARIANT = 100;

/** After this many hours with no significant winner, mark as 'no_winner' (or marginal if substantial lead). */
export const MAX_WINDOW_HOURS = 48;

/** Chi-square significance threshold. Winner must have p < 0.05. */
export const SIGNIFICANCE_LEVEL = 0.05;

/** Minimum absolute CTR difference (percentage points) to consider "meaningful" at max window. */
export const MIN_CTR_DIFF_PCT = 0.5; // 0.5 percentage points
