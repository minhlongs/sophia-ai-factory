/**
 * @module seed/ai/creative-provider
 *
 * CreativeProvider — opt-in extension of the model-agnostic Provider
 * interface that adds creative-economy generation methods.
 *
 * Layer rule: seed only — no imports from tree/, forest/, or land/.
 *
 * This is an EXTENSION, never a replacement. Existing adapters
 * (OpenRouter, Anthropic, ElevenLabs) continue to implement `Provider`;
 * creative workflows opt into `CreativeProvider` when the underlying
 * adapter supports creative generation.
 */

import type {
  Provider,
  ProviderId,
  ChatMessage,
  ChatOptions,
  ChatResponse,
  StreamChunk,
  ProviderCapabilities,
} from './provider-interface';

/**
 * Creative generation request — a thin wrapper that carries the creative
 * context (identity, audience, format) alongside standard chat options.
 */
export interface CreativeGenerationRequest {
  /** Creative brief / concept to expand into a deliverable. */
  brief: string;
  /** Standard chat options (model, credentials, generation params). */
  options: ChatOptions;
  /** Optional messages prepended to the brief (system/role context). */
  prefix?: ChatMessage[];
}

/**
 * CreativeProvider extends Provider with the three generation primitives
 * the Creative Economy OS flywheel needs: script, storyboard, thumbnail.
 *
 * Implementations MUST NOT throw at construction time for missing
 * credentials (see Provider contract).
 */
export interface CreativeProvider extends Provider {
  /**
   * Generate a script from a creative brief.
   *
   * @returns Complete response with the script text and token usage.
   */
  generateScript(
    request: CreativeGenerationRequest,
  ): Promise<ChatResponse>;

  /**
   * Generate a storyboard description from a script or brief.
   */
  generateStoryboard(
    request: CreativeGenerationRequest,
  ): Promise<ChatResponse>;

  /**
   * Generate a thumbnail concept / visual prompt from a concept.
   */
  generateThumbnail(
    request: CreativeGenerationRequest,
  ): Promise<ChatResponse>;
}

/**
 * Type guard: does an unknown provider expose the creative extension?
 *
 * Adapters that only implement `Provider` (e.g. ElevenLabs TTS) return
 * false here so callers can fall back to plain `chat()`.
 */
export function isCreativeProvider(
  provider: Provider,
): provider is CreativeProvider {
  return (
    typeof (provider as Partial<CreativeProvider>).generateScript === 'function' &&
    typeof (provider as Partial<CreativeProvider>).generateStoryboard === 'function' &&
    typeof (provider as Partial<CreativeProvider>).generateThumbnail === 'function'
  );
}

/**
 * Re-export the underlying provider types so creative consumers can
 * import everything from this module without pulling provider-interface
 * directly.
 */
export type {
  Provider,
  ProviderId,
  ChatMessage,
  ChatOptions,
  ChatResponse,
  StreamChunk,
  ProviderCapabilities,
};