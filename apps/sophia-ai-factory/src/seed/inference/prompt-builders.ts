/**
 * Shared prompt builders for AI inference (OpenRouter / Anthropic BYOK).
 * Layer: seed (primitives — reusable by any layer).
 *
 * @module seed/inference/prompt-builders
 */

export interface TopVideoMetric {
  videoId: string;
  views: number;
  ctr: number;
  watchTimeSec: number;
}

/**
 * Build the analytics insights prompt from pre-formatted summary text.
 * Reusable by land (content-insights-generator) and forest (strategy-feedback).
 *
 * @param summaryText - pre-formatted summary block (views, CTR, watch time, etc.)
 * @param topVideos - top performing videos with metrics
 */
export function buildInsightsPrompt(
  summaryText: string,
  topVideos: TopVideoMetric[],
): string {
  const top = topVideos.slice(0, 3).map(v =>
    `- Views: ${v.views}, CTR: ${(v.ctr * 100).toFixed(1)}%, WatchTime: ${Math.round(v.watchTimeSec / 60)}min`,
  ).join('\n');

  return `You are a content strategy analyst. Given these YouTube video performance metrics, identify patterns in high-performing content and suggest 3-5 improvements for future videos.

Summary (last 30 days):
${summaryText}

Top performing videos:
${top || 'No data yet'}

Respond ONLY with valid JSON in this exact format:
{
  "insights": [
    {
      "insight": "specific observation about what works",
      "recommendation": "actionable next step",
      "confidence": "high" | "medium" | "low"
    }
  ]
}`;
}

/** ROI summary for a single content project (used by prompt builder) */
export interface ContentRoiSummary {
  title: string;
  roi: number;
  revenueCents: number;
  costCents: number;
  events: number;
  topChannel: string;
}

/**
 * Build ROI-enhanced content insights prompt.
 * Includes per-project ROI data alongside performance metrics.
 * Reusable by land (content-insights-generator).
 *
 * @param summaryText - pre-formatted summary block
 * @param roiProjects - top projects by ROI (positive only)
 * @param hasData - false when roi_records is empty
 */
export function buildContentRoiPrompt(
  summaryText: string,
  roiProjects: ContentRoiSummary[],
  hasData: boolean,
): string {
  const projectLines = roiProjects.length > 0
    ? roiProjects.map(p =>
        `- "${p.title}" | ROI: ${p.roi}x | Rev: $${(p.revenueCents / 100).toFixed(2)} | Cost: $${(p.costCents / 100).toFixed(2)} | Events: ${p.events} | Top channel: ${p.topChannel}`,
      ).join('\n')
    : 'No ROI data yet — suggest tracking setup.';

  const dataNotice = hasData ? '' : '\nNOTE: ROI records are empty. Focus on performance metrics only.';

  return `You are a content ROI strategist. Given these metrics, identify which content projects are most profitable and recommend actions to improve ROI.

Performance Summary (last 30 days):
${summaryText}

Content Projects by ROI (sorted descending):
${projectLines}${dataNotice}

Respond ONLY with valid JSON in this exact format:
{
  "insights": [
    {
      "insight": "specific ROI observation about what's working or not",
      "recommendation": "actionable step to improve ROI",
      "confidence": "high" | "medium" | "low"
    }
  ]
}`;
}