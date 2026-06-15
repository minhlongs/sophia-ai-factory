/** D1 signal events — canonical source for cross-layer access */
export const D1Events = {
  TIER_CONVERSION: 'tier_conversion',
  PAYMENT_SUCCESS: 'payment_success',
  PAYMENT_FAILED: 'payment_failed',
  AGENT_DISPATCH: 'agent_dispatch',
  API_RATE_LIMIT_HIT: 'api_rate_limit_hit',
  BYOK_CALL: 'byok_call',
  BYOK_TIMEOUT: 'byok_timeout',
  LOCAL_MODE_PROVISIONED: 'local_mode_provisioned',
  LOCAL_MODE_HEALTHY: 'local_mode_healthy',
  LOCAL_MODE_UNHEALTHY: 'local_mode_unhealthy',
  LOCAL_MODE_DISABLED: 'local_mode_disabled',
  WORKFLOW_STARTED: 'workflow_started',
  WORKFLOW_STEP_COMPLETED: 'workflow_step_completed',
  WORKFLOW_COMPLETED: 'workflow_completed',
  WORKFLOW_FAILED: 'workflow_failed',
  PROMPT_INJECTION_DETECTED: 'prompt_injection_detected',
  LLM_CALL_TRACE: 'llm_call_trace',
  BYOK_KEY_SET: 'byok_key_set',
  BYOK_KEY_CLEARED: 'byok_key_cleared',
} as const;
export type D1EventKey = typeof D1Events[keyof typeof D1Events];
