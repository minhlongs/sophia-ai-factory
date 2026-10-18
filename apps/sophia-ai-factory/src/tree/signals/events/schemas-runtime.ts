/**
 * D1 Signal Schemas — Agent, Workflow & Runtime Observability
 * Layer: tree/signals/events
 */

import { z } from 'zod';

export const AgentDispatchSchema = z.object({
  campaign_id: z.string(),
  channel_count: z.number().int().nonnegative(),
  command: z.string().optional(),
});

export const ByokCallSchema = z.object({
  provider: z.string(),
  status_code: z.number().int(),
  latency_ms: z.number().nonnegative(),
  error_class: z.string().optional(),
});

export const ByokTimeoutSchema = z.object({
  provider: z.string(),
  timeout_ms: z.number().nonnegative(),
});

export const LocalModeProvisionedSchema = z.object({
  user_id: z.string(),
  hostname_hash: z.number().int(),
});

export const LocalModeHealthySchema = z.object({
  user_id: z.string(),
  latency_ms: z.number().nonnegative(),
});

export const LocalModeUnhealthySchema = z.object({
  user_id: z.string(),
  endpoint_hash: z.number().int(),
  status: z.union([z.number().int(), z.string()]).optional(),
});

export const LocalModeDisabledSchema = z.object({
  user_id: z.string(),
  reason: z.string(),
});

export const WorkflowStartedSchema = z.object({
  workflow_id: z.string(),
  org_id: z.string(),
  step_count: z.number().int().nonnegative().optional(),
});

export const WorkflowStepCompletedSchema = z.object({
  workflow_id: z.string(),
  step_order: z.number().int().min(1).max(3),
  step_type: z.string(),
  duration_ms: z.number().nonnegative().optional(),
});

export const WorkflowCompletedSchema = z.object({
  workflow_id: z.string(),
  org_id: z.string(),
  duration_ms: z.number().nonnegative().optional(),
});

export const WorkflowFailedSchema = z.object({
  workflow_id: z.string(),
  step_order: z.number().int().min(1).max(3).optional(),
  step_type: z.string().optional(),
  error_class: z.string().optional(),
});

export const LlmCallTraceSchema = z.object({
  trace_id: z.string(),
  workflow_id: z.string(),
  step_order: z.number().int().min(1).max(3),
  step_type: z.string(),
  provider: z.string(),
  model: z.string(),
  duration_ms: z.number().nonnegative(),
  ok: z.boolean(),
  error_class: z.string().optional(),
  input_tokens: z.number().int().nonnegative().optional(),
  output_tokens: z.number().int().nonnegative().optional(),
  cost_usd: z.number().nonnegative().optional(),
});

export const AgentTaskStartSchema = z.object({
  task_id: z.string(),
  agent_role: z.string(),
  agent_id: z.string(),
  variant: z.string(),
});

export const AgentTaskCompleteSchema = z.object({
  task_id: z.string(),
  agent_role: z.string(),
  variant: z.string(),
  duration_ms: z.number().nonnegative(),
  tokens_used: z.number().int().nonnegative().optional(),
});

export const AgentTaskFailSchema = z.object({
  task_id: z.string(),
  agent_role: z.string(),
  variant: z.string(),
  error_class: z.string(),
});

export const AgentFeedbackSchema = z.object({
  task_id: z.string(),
  agent_role: z.string(),
  score: z.union([z.literal(1), z.literal(-1)]),
  comment: z.string().max(280).optional(),
});
