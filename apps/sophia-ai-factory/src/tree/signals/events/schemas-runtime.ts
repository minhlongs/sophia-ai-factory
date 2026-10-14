/**
 * D1 Signal Schemas — Agent, Workflow & Runtime Observability
 *
 * Layer: tree/signals/events
 */

import { z } from 'zod';

/** agent_dispatch — fired on each OpenClaw channel distribute() call */
export const AgentDispatchSchema = z.object({
  campaign_id:  z.string(),
  channel_count: z.number().int().nonnegative(),
  command:      z.string().optional(),
});

/** byok_call — fired per outbound BYOK provider call */
export const ByokCallSchema = z.object({
  provider:     z.string(),   // 'elevenlabs' | 'openrouter' | 'did' | etc.
  status_code:  z.number().int(),
  latency_ms:   z.number().nonnegative(),
  error_class:  z.string().optional(),  // Error.name if call failed
});

/** byok_timeout — reserved for Phase 5 */
export const ByokTimeoutSchema = z.object({
  provider:     z.string(),
  timeout_ms:   z.number().nonnegative(),
});

/** local_mode_provisioned — fired when customer's mekongd tunnel is registered (Phase D) */
export const LocalModeProvisionedSchema = z.object({
  user_id:       z.string(),
  hostname_hash: z.number().int(), // FNV-1a hash of hostname — no raw URL stored
});

/** local_mode_healthy — cron ping succeeded for user's tunnel */
export const LocalModeHealthySchema = z.object({
  user_id:    z.string(),
  latency_ms: z.number().nonnegative(),
});

/** local_mode_unhealthy — cron ping failed or timed out */
export const LocalModeUnhealthySchema = z.object({
  user_id:       z.string(),
  endpoint_hash: z.number().int(), // FNV-1a hash — no raw URL stored
  status:        z.union([z.number().int(), z.string()]).optional(),
});

/** local_mode_disabled — tunnel auto-disabled after 3 consecutive failures */
export const LocalModeDisabledSchema = z.object({
  user_id: z.string(),
  reason:  z.string(),
});

/** workflow_started — fired when POST /api/raas/workflows creates workflow + 3 step missions */
export const WorkflowStartedSchema = z.object({
  workflow_id: z.string(),
  org_id:      z.string(),
  step_count:  z.number().int().nonnegative().optional(),
});

/** workflow_step_completed — fired by cron stepper when a step mission completes */
export const WorkflowStepCompletedSchema = z.object({
  workflow_id:  z.string(),
  step_order:   z.number().int().min(1).max(3),
  step_type:    z.string(),
  duration_ms:  z.number().nonnegative().optional(),
});

/** workflow_completed — fired when all 3 step missions complete */
export const WorkflowCompletedSchema = z.object({
  workflow_id: z.string(),
  org_id:      z.string(),
  duration_ms: z.number().nonnegative().optional(),
});

/** workflow_failed — fired when a step mission fails, blocking the workflow */
export const WorkflowFailedSchema = z.object({
  workflow_id:  z.string(),
  step_order:   z.number().int().min(1).max(3).optional(),
  step_type:    z.string().optional(),
  error_class:  z.string().optional(),
});

/** llm_call_trace — per-step LLM call observability (Phase 4B Advanced Observability) */
export const LlmCallTraceSchema = z.object({
  trace_id:       z.string(),
  workflow_id:    z.string(),
  step_order:     z.number().int().min(1).max(3),
  step_type:      z.string(),
  provider:       z.string(),
  model:          z.string(),
  duration_ms:    z.number().nonnegative(),
  ok:             z.boolean(),
  error_class:    z.string().optional(),
  input_tokens:   z.number().int().nonnegative().optional(),
  output_tokens:  z.number().int().nonnegative().optional(),
  cost_usd:       z.number().nonnegative().optional(),
});

/** agent_task_start — fired before LLM call in runner */
export const AgentTaskStartSchema = z.object({
  task_id:    z.string(),
  agent_role: z.string(),
  agent_id:   z.string(),
  variant:    z.string(),
});

/** agent_task_complete — fired on successful LLM response */
export const AgentTaskCompleteSchema = z.object({
  task_id:     z.string(),
  agent_role:  z.string(),
  variant:     z.string(),
  duration_ms: z.number().nonnegative(),
  tokens_used: z.number().int().nonnegative().optional(),
});

/** agent_task_fail — fired when runner throws */
export const AgentTaskFailSchema = z.object({
  task_id:     z.string(),
  agent_role:  z.string(),
  variant:     z.string(),
  error_class: z.string(),
});

/** agent_feedback — fired when user submits thumbs up/down */
export const AgentFeedbackSchema = z.object({
  task_id:    z.string(),
  agent_role: z.string(),
  score:      z.union([z.literal(1), z.literal(-1)]),
  comment:    z.string().max(280).optional(),
});
