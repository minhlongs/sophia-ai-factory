/**
 * Command Model Routing — Per-command LLM model selection for cost optimization.
 *
 * Haiku:  cheap + fast   (~$0.01/mission) — simple/short tasks
 * Sonnet: default        (~$0.05-0.08/mission) — most tasks
 * Opus:   complex reason (~$0.15/mission) — deep analysis only
 */

// ── Types ────────────────────────────────────────────────────────────────────

export type CommandName =
  | 'proposal:create'
  | 'video:create'
  | 'content:blog'
  | 'content:social'
  | 'crm:sync'
  | 'analytics:export'
  | 'gtm:campaign'
  | 'sales:battlecard'
  | 'sales:proposal-deck'
  | 'sales:roi-calculator'
  | 'sales:competitor-analysis'
  | 'sales:pricing-optimizer'
  | 'sales:outreach-sequence'
  | 'lead:generate'
  | 'email:send';

export interface ModelConfig {
  model: string;
  maxTokens: number;
  estimatedMcuCost: number;
}

// ── Model IDs ────────────────────────────────────────────────────────────────

const HAIKU = 'claude-haiku-4-5-20251001';
const SONNET = 'claude-sonnet-4-20250514';
const OPUS = 'claude-opus-4-6';

// ── Routing Table ────────────────────────────────────────────────────────────

const ROUTING_TABLE: Record<CommandName, ModelConfig> = {
  // Haiku — fast, cheap, simple tasks
  'email:send':         { model: HAIKU,  maxTokens: 1000, estimatedMcuCost: 0.01 },
  'content:social':     { model: HAIKU,  maxTokens: 1000, estimatedMcuCost: 0.01 },

  // Sonnet — balanced default for most commands
  'proposal:create':    { model: SONNET, maxTokens: 2000, estimatedMcuCost: 0.06 },
  'video:create':       { model: SONNET, maxTokens: 2000, estimatedMcuCost: 0.06 },
  'content:blog':       { model: SONNET, maxTokens: 2000, estimatedMcuCost: 0.06 },
  'crm:sync':           { model: SONNET, maxTokens: 1500, estimatedMcuCost: 0.05 },
  'analytics:export':   { model: SONNET, maxTokens: 1500, estimatedMcuCost: 0.05 },
  'gtm:campaign':       { model: SONNET, maxTokens: 2000, estimatedMcuCost: 0.06 },
  'sales:battlecard':   { model: SONNET, maxTokens: 2000, estimatedMcuCost: 0.06 },
  'sales:proposal-deck':{ model: SONNET, maxTokens: 2000, estimatedMcuCost: 0.06 },
  'sales:roi-calculator':{ model: SONNET, maxTokens: 1500, estimatedMcuCost: 0.05 },
  'sales:pricing-optimizer': { model: SONNET, maxTokens: 1500, estimatedMcuCost: 0.05 },
  'sales:outreach-sequence': { model: SONNET, maxTokens: 2000, estimatedMcuCost: 0.06 },
  'lead:generate':      { model: SONNET, maxTokens: 3000, estimatedMcuCost: 0.08 },

  // Opus — deep reasoning tasks
  'sales:competitor-analysis': { model: OPUS, maxTokens: 3000, estimatedMcuCost: 0.15 },
};

const DEFAULT_CONFIG: ModelConfig = { model: SONNET, maxTokens: 2000, estimatedMcuCost: 0.06 };

// ── Public API ────────────────────────────────────────────────────────────────

export function getModelConfig(command: CommandName): ModelConfig {
  return ROUTING_TABLE[command] ?? DEFAULT_CONFIG;
}

export function getModelForCommand(command: string): string {
  return ROUTING_TABLE[command as CommandName]?.model ?? DEFAULT_CONFIG.model;
}

export function getMaxTokensForCommand(command: string): number {
  return ROUTING_TABLE[command as CommandName]?.maxTokens ?? DEFAULT_CONFIG.maxTokens;
}
