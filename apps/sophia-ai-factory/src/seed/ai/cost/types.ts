/**
 * @module seed/ai/cost/types
 * Cost estimation and pricing model type definitions.
 * Layer rule: seed only.
 */

export type CostKind = 'metered' | 'unmetered' | 'internal' | 'unknown';

export interface CostEstimate {
  usd: number;
  kind: CostKind;
}

export type InputPrice = number;
export type OutputPrice = number;
export type PerCharPrice = number;
export type PerSecondPrice = number;

export interface TextModelPricing {
  type: 'text';
  input: InputPrice;
  output: OutputPrice;
}

export interface TtsModelPricing {
  type: 'tts';
  perChar: PerCharPrice;
}

export interface VideoModelPricing {
  type: 'video';
  perSecond: PerSecondPrice;
}

export type ModelPricing = TextModelPricing | TtsModelPricing | VideoModelPricing;
