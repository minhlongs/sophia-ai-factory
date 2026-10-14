/**
 * D1 Signal Schemas Registry & Lookup
 *
 * Layer: tree/signals/events
 */

import { z } from 'zod';
import { D1Events, type D1EventType } from './constants';
import {
  ApiRateLimitHitSchema,
  ByokKeyAdminSchema,
  CheckoutStartedSchema,
  DiscoveryScoreRequestedSchema,
  PaymentFailedSchema,
  PaymentSuccessSchema,
  PromptInjectionDetectedSchema,
  TierConversionSchema,
} from './schemas-business';
import {
  AgentDispatchSchema,
  AgentFeedbackSchema,
  AgentTaskCompleteSchema,
  AgentTaskFailSchema,
  AgentTaskStartSchema,
  ByokCallSchema,
  ByokTimeoutSchema,
  LlmCallTraceSchema,
  LocalModeDisabledSchema,
  LocalModeHealthySchema,
  LocalModeProvisionedSchema,
  LocalModeUnhealthySchema,
  WorkflowCompletedSchema,
  WorkflowFailedSchema,
  WorkflowStartedSchema,
  WorkflowStepCompletedSchema,
} from './schemas-runtime';

export const SCHEMAS: Record<D1EventType, z.ZodTypeAny> = {
  [D1Events.TIER_CONVERSION]:           TierConversionSchema,
  [D1Events.PAYMENT_SUCCESS]:           PaymentSuccessSchema,
  [D1Events.PAYMENT_FAILED]:            PaymentFailedSchema,
  [D1Events.AGENT_DISPATCH]:            AgentDispatchSchema,
  [D1Events.API_RATE_LIMIT_HIT]:        ApiRateLimitHitSchema,
  [D1Events.BYOK_CALL]:                 ByokCallSchema,
  [D1Events.BYOK_TIMEOUT]:              ByokTimeoutSchema,
  [D1Events.LOCAL_MODE_PROVISIONED]:    LocalModeProvisionedSchema,
  [D1Events.LOCAL_MODE_HEALTHY]:        LocalModeHealthySchema,
  [D1Events.LOCAL_MODE_UNHEALTHY]:      LocalModeUnhealthySchema,
  [D1Events.LOCAL_MODE_DISABLED]:       LocalModeDisabledSchema,
  [D1Events.WORKFLOW_STARTED]:          WorkflowStartedSchema,
  [D1Events.WORKFLOW_STEP_COMPLETED]:   WorkflowStepCompletedSchema,
  [D1Events.WORKFLOW_COMPLETED]:        WorkflowCompletedSchema,
  [D1Events.WORKFLOW_FAILED]:           WorkflowFailedSchema,
  [D1Events.PROMPT_INJECTION_DETECTED]: PromptInjectionDetectedSchema,
  [D1Events.LLM_CALL_TRACE]:            LlmCallTraceSchema,
  [D1Events.BYOK_KEY_SET]:              ByokKeyAdminSchema,
  [D1Events.BYOK_KEY_CLEARED]:          ByokKeyAdminSchema,
  [D1Events.DISCOVERY_SCORE_REQUESTED]: DiscoveryScoreRequestedSchema,
  [D1Events.AGENT_TASK_START]:          AgentTaskStartSchema,
  [D1Events.AGENT_TASK_COMPLETE]:       AgentTaskCompleteSchema,
  [D1Events.AGENT_TASK_FAIL]:           AgentTaskFailSchema,
  [D1Events.AGENT_FEEDBACK]:            AgentFeedbackSchema,
  [D1Events.CHECKOUT_STARTED]:          CheckoutStartedSchema,
};

/**
 * Return the Zod schema for a given D1 event type.
 * Used by track() to validate + strip props before insert.
 */
export function schemaForEvent(event: D1EventType): z.ZodSchema<Record<string, unknown>> {
  return SCHEMAS[event] as z.ZodSchema<Record<string, unknown>>;
}
