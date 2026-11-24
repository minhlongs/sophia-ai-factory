/**
 * Canonical BASIC First-Value Journey contract and pure state helpers.
 *
 * Enforces:
 * - Fixture/simulated scripts are explicitly labeled and never treated as live AI proof.
 * - HTTP 200 generation never counts as acceptance; explicit user action is required.
 * - Missing or invalid scripts cannot be accepted.
 * - Private retrieval only; publicPublished is always false.
 *
 * @module tree/first-value/first-value-contract
 */

import type { ScriptOutput } from '@/seed/ai/script-generator';
import type { FirstValueCostPreview } from '@/seed/ai/cost/first-value-cost-preview';
import type { HonestValidationReceipt } from '@/tree/byok/honest-validation-receipt';

export type ScriptProvenance = 'fixture_simulated' | 'live_provider';
export type ScriptReviewState = 'pending_review' | 'accepted' | 'rejected';

export interface FirstValueScriptArtifact {
  readonly artifactId: string;
  readonly sessionId: string;
  readonly userId: string;
  readonly orgId: string;
  readonly version: number;
  readonly idempotencyKey: string;
  readonly topic: string;
  readonly audience: string;
  readonly durationSec: number;
  readonly provenance: ScriptProvenance;
  readonly provenanceLabel: string;
  readonly script: ScriptOutput;
  readonly reviewState: ScriptReviewState;
  readonly acceptedAtIso: string | null;
  readonly acceptedByUserId: string | null;
  readonly rejectedAtIso: string | null;
  readonly rejectionReason: string | null;
  readonly publicPublished: false;
  readonly mcuCharged: number;
  readonly optionalNotificationDelivered: boolean;
  readonly createdAtIso: string;
}

export interface FirstValuePrivateExport {
  readonly artifactId: string;
  readonly orgId: string;
  readonly version: number;
  readonly provenance: ScriptProvenance;
  readonly provenanceLabel: string;
  readonly reviewState: ScriptReviewState;
  readonly publicPublished: false;
  readonly cacheControl: 'private, no-store';
  readonly format: 'json' | 'markdown';
  readonly content: ScriptOutput | string;
}

export interface FirstValueSessionContext {
  readonly sessionId: string;
  readonly userId: string;
  readonly orgId: string;
  readonly startedAtMs: number;
  readonly receipt: HonestValidationReceipt | null;
  readonly costPreview: FirstValueCostPreview | null;
}

export function buildDeterministicFixtureScript(
  topic: string,
  audience: string,
  durationSec: number,
): ScriptOutput {
  const safeDuration = Math.max(15, Math.min(300, Math.round(durationSec || 30)));
  const hookSec = Math.max(5, Math.round(safeDuration * 0.25));
  const bodySec = Math.max(5, Math.round(safeDuration * 0.5));
  const ctaSec = Math.max(5, safeDuration - hookSec - bodySec);

  return {
    title: `[SIMULATED FIXTURE] ${topic}`,
    total_duration: hookSec + bodySec + ctaSec,
    scenes: [
      {
        scene_number: 1,
        duration_estimate: hookSec,
        visual_description: `Opening title card tailored for ${audience}`,
        narration: `[Fixture Hook] Here is a structured BASIC script preview for ${audience} about ${topic}.`,
      },
      {
        scene_number: 2,
        duration_estimate: bodySec,
        visual_description: `Key talking points breakdown for ${topic}`,
        narration: `[Fixture Body] Focus on one concrete customer pain point, one clear takeaway, and zero technical jargon.`,
      },
      {
        scene_number: 3,
        duration_estimate: ctaSec,
        visual_description: `Closing review card with private export prompt`,
        narration: `[Fixture CTA] Review this draft, edit if needed, and explicitly accept before exporting privately.`,
      },
    ],
  };
}

export function getProvenanceLabel(provenance: ScriptProvenance): string {
  return provenance === 'fixture_simulated'
    ? 'SIMULATED_FIXTURE_NOT_LIVE_AI_INFERENCE'
    : 'LIVE_PROVIDER_INFERENCE';
}

export function renderFirstValueMarkdown(artifact: FirstValueScriptArtifact): string {
  const lines: string[] = [
    `# ${artifact.script.title}`,
    '',
    `- **Artifact ID:** ${artifact.artifactId}`,
    `- **Organization ID:** ${artifact.orgId}`,
    `- **Version:** v${artifact.version}`,
    `- **Provenance:** ${artifact.provenance} (${artifact.provenanceLabel})`,
    `- **Review State:** ${artifact.reviewState}`,
    `- **Public Published:** false`,
    `- **Total Duration:** ${artifact.script.total_duration}s`,
    '',
    '## Scenes',
    '',
  ];

  for (const scene of artifact.script.scenes) {
    const headingTitle = scene.title ? `: ${scene.title}` : '';
    lines.push(`### Scene ${scene.scene_number}${headingTitle} (${scene.duration_estimate}s)`);
    lines.push(`- **Visual:** ${scene.visual_description}`);
    lines.push(`- **Narration:** ${scene.narration}`);
    lines.push('');
  }

  return lines.join('\n');
}
