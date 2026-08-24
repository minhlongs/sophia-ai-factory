/**
 * Builtin Agent Definitions
 *
 * Registers canonical agent definitions using model IDs sourced from
 * the seed/ai/cost-estimator.ts pricing table so cost accounting works.
 *
 * Layer: tree (domain-specific reusable)
 * @module tree/agent-protocol
 */

import type { ModelCapability } from '@/seed/types/creative-domain';
import { agentDefinitionRegistry } from './agent-registry';
import type { AgentDefinition } from '@/seed/types/creative-domain';

/**
 * Mapping from capability to cheapest available model ID in the
 * seed/ai/cost-estimator.ts price table. Prices are in USD per 1K tokens.
 *
 * Source of truth: src/seed/ai/cost-estimator.ts MODEL_PRICING table.
 * Keep this in sync when pricing table updates.
 *
 * Note: Only text models have explicit pricing. Vision, image, video, audio,
 * tts, stt, embedding, reasoning, and code fall back to the cheapest text
 * model (meta-llama/llama-4-scout at $0.10/$0.30). Update when pricing
 * table expands with capability-specific entries.
 */
export const MODEL_BY_CAPABILITY: Record<ModelCapability, string> = {
  // Text generation — cheapest available: meta-llama/llama-4-scout at $0.10/$0.30 per 1K
  text: 'meta-llama/llama-4-scout',
  // Vision — no dedicated vision pricing; fallback to cheapest text model
  vision: 'meta-llama/llama-4-scout',
  // Image generation — not in text table, fallback
  image: 'meta-llama/llama-4-scout',
  // Video — not in text table, fallback
  video: 'meta-llama/llama-4-scout',
  // Audio — not in text table, fallback
  audio: 'meta-llama/llama-4-scout',
  // TTS — ElevenLabs, not a chat model, fallback
  tts: 'meta-llama/llama-4-scout',
  // STT — not a chat model, fallback
  stt: 'meta-llama/llama-4-scout',
  // Embedding — not a chat model, fallback
  embedding: 'meta-llama/llama-4-scout',
  // Reasoning — no dedicated reasoning pricing; fallback to cheapest text model
  reasoning: 'meta-llama/llama-4-scout',
  // Code — no dedicated code pricing; fallback to cheapest text model
  code: 'meta-llama/llama-4-scout',
};

/**
 * Resolve a model ID for a given capability.
 *
 * Returns the cheapest model from the pricing table that supports the capability.
 * Falls back to 'meta-llama/llama-4-scout' for unknown capabilities.
 */
export function resolveModelForCapability(capability: ModelCapability): string {
  return MODEL_BY_CAPABILITY[capability] ?? MODEL_BY_CAPABILITY.text;
}

/**
 * Idempotent registration of builtin agent definitions.
 *
 * Guards on `has()` so double-import / re-call does not duplicate.
 * Called at module load so the registry is ready before any executor runs.
 */
export function registerBuiltinAgents(): void {
  if (agentDefinitionRegistry.has('sophia-content-writer')) {
    return;
  }

  const definition: AgentDefinition = {
    id: 'sophia-content-writer',
    name: 'Sophia Content Writer',
    role: 'You are an expert copywriter. Write engaging content per the brief.',
    capabilities: ['generate_text'],
    permissions: [
      {
        tool: 'generate_text',
        scopes: [],
        requiresApproval: false,
        maxCostCents: 500,
      },
    ],
    defaultAutonomy: 1,
    maxRetries: 2,
    timeoutMs: 120_000,
    modelPolicy: {
      capability: 'text',
      costPolicy: 'cheap',
      maxCostCents: 500,
      requiredQuality: 0.7,
    },
  };

  agentDefinitionRegistry.register(definition);
}

// Auto-register at module load
registerBuiltinAgents();