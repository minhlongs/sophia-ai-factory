/**
 * Canonical list of MuAPI-hosted image models.
 *
 * Lives in seed so the tier access map below stays free of tree imports.
 * `@/tree/clients/muapi-media-client` re-exports this value as
 * `SUPPORTED_MODELS.image`, keeping the client module's public shape intact.
 *
 * @module seed/config/tiers/supported-image-models
 */

export const SUPPORTED_IMAGE_MODELS: readonly string[] = [
  'midjourney-v7',
  'flux-schnell',
  'flux-dev',
  'hidream',
  'flux-kontext',
];
