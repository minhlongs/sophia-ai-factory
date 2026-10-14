/**
 * Typed Prompt Contracts & Bounded Iteration Guards for Multi-Agent execution
 */

import type { SOPAgentRole } from './multi-agent-session';

/** Base fields common to all agent prompt contracts */
export interface PromptContractBase {
  objective: string;
  outputFormat: 'json' | 'markdown' | 'text' | 'structured';
  maxTokens?: number;
  escalationRules?: string[];
}

/** script_writer: generates content scripts */
export interface ScriptWriterContract extends PromptContractBase {
  topic: string;
  tone: 'professional' | 'casual' | 'educational' | 'entertaining';
  targetLength: 'short' | 'medium' | 'long';
}

/** voice_generator: produces audio/voice-over assets */
export interface VoiceGeneratorContract extends PromptContractBase {
  voiceId: string;
  language: string;
  scriptText: string;
}

/** video_producer: assembles video from assets */
export interface VideoProducerContract extends PromptContractBase {
  audioUrl: string;
  visualStyle: string;
  duration?: number;
}

/** publisher: distributes finished content to platforms */
export interface PublisherContract extends PromptContractBase {
  platforms: string[];
  scheduledAt?: string;
  metadata?: Record<string, unknown>;
}

/** analyst: evaluates results and surfaces insights */
export interface AnalystContract extends PromptContractBase {
  metrics: string[];
  timeRange: { start: string; end: string };
  compareWith?: string;
}

/** supervisor: orchestrates the session, dispatches workers */
export interface SupervisorContract extends PromptContractBase {
  pipeline: SOPAgentRole[];
  config?: Record<string, unknown>;
}

/** Union of all typed prompt contracts */
export type PromptContract =
  | ScriptWriterContract
  | VoiceGeneratorContract
  | VideoProducerContract
  | PublisherContract
  | AnalystContract
  | SupervisorContract;

export interface IterationLimits {
  maxRetriesPerSubtask: number;
  maxTotalIterations: number;
}

export const DEFAULT_ITERATION_LIMITS: IterationLimits = {
  maxRetriesPerSubtask: 5,
  maxTotalIterations: 20,
};

export interface IterationBudgetCheck {
  canProceed: boolean;
  remaining: number;
  reason?: string;
}
