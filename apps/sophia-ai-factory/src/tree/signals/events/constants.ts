/**
 * D1 Signal Event Enumerations and Types
 *
 * Layer: tree/signals/events
 */

export const D1Events = {
  TIER_CONVERSION:          'tier_conversion',
  PAYMENT_SUCCESS:          'payment_success',
  PAYMENT_FAILED:           'payment_failed',
  AGENT_DISPATCH:           'agent_dispatch',
  API_RATE_LIMIT_HIT:       'api_rate_limit_hit',
  BYOK_CALL:                'byok_call',
  BYOK_TIMEOUT:             'byok_timeout',           // reserved — Phase 5
  LOCAL_MODE_PROVISIONED:   'local_mode_provisioned', // Phase D
  LOCAL_MODE_HEALTHY:       'local_mode_healthy',     // Phase F — cron ping success
  LOCAL_MODE_UNHEALTHY:     'local_mode_unhealthy',   // Phase F — cron ping failure
  LOCAL_MODE_DISABLED:      'local_mode_disabled',    // Phase F — auto-disabled after 3 fails
  WORKFLOW_STARTED:         'workflow_started',        // Supervisor: workflow created + queued
  WORKFLOW_STEP_COMPLETED:  'workflow_step_completed', // Supervisor: one step mission done
  WORKFLOW_COMPLETED:       'workflow_completed',      // Supervisor: all 3 steps done
  WORKFLOW_FAILED:          'workflow_failed',         // Supervisor: step mission failed
  PROMPT_INJECTION_DETECTED: 'prompt_injection_detected', // Phase 4A: guard flagged prompt at ingress
  LLM_CALL_TRACE:            'llm_call_trace',            // Phase 4B: per-step LLM call observability
  BYOK_KEY_SET:              'byok_key_set',              // Phase 8C: user-facing BYOK admin — store/rotate
  BYOK_KEY_CLEARED:          'byok_key_cleared',          // Phase 8C: user-facing BYOK admin — delete
  DISCOVERY_SCORE_REQUESTED: 'discovery_score_requested', // R10: audit trail for OpenRouter-backed scoring
  AGENT_TASK_START:          'agent_task_start',           // Phase 03: agent task begins LLM call
  AGENT_TASK_COMPLETE:       'agent_task_complete',         // Phase 03: agent task finished successfully
  AGENT_TASK_FAIL:           'agent_task_fail',             // Phase 03: agent task failed
  AGENT_FEEDBACK:            'agent_feedback',              // Phase 03: user thumbs up/down on task result
  CHECKOUT_STARTED:          'checkout_started',            // Phase 03: user initiates paid tier checkout
} as const;

export type D1EventType = typeof D1Events[keyof typeof D1Events];
