/**
 * Provenance input contract — canonical source for cross-layer access.
 *
 * The claim/source review that gates a YouTube publish is decided in `tree`,
 * but `PublishMeta` and the Inngest publish events live in `seed`, which cannot
 * import `tree`. Keeping the pure input shape here lets every layer thread
 * optional provenance records without violating layer boundaries.
 * @module seed/types/provenance
 */

export interface ProvenanceInput {
  readonly sources?: readonly Record<string, unknown>[];
  readonly claims?: readonly Record<string, unknown>[];
  readonly containsSyntheticMedia?: boolean;
}
