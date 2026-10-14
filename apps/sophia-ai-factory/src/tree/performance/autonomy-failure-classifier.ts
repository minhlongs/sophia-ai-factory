/**
 * Autonomy failure taxonomy and deterministic classifier (Phase G).
 * @module tree/performance/autonomy-failure-classifier
 */

export const AUTONOMY_FAILURE_CLASSES = [
  'REASONING_ERROR',
  'BAD_CONTEXT',
  'BAD_MEMORY',
  'TOOL_ERROR',
  'PROVIDER_ERROR',
  'TIMEOUT',
  'PERMISSION_ERROR',
  'APPROVAL_ERROR',
  'COST_LIMIT',
  'POLICY_BLOCK',
  'USER_AMBIGUITY',
  'UNKNOWN',
] as const;

export type AutonomyFailureClass = (typeof AUTONOMY_FAILURE_CLASSES)[number];

/**
 * Classify an arbitrary error/failure into one of the 12 autonomy classes.
 * PURE: no side effects, no D1, no logging. Deterministic on inputs.
 */
export function classifyAutonomyFailure(
  error: unknown,
  context?: {
    code?: string;
    message?: string;
    approvalOutcome?: 'approved' | 'rejected' | 'timeout' | 'skipped';
    budgetExhausted?: boolean;
    permissionDenied?: boolean;
    userInterventionRequired?: boolean;
  },
): AutonomyFailureClass {
  const code = (context?.code ?? (error as { code?: string })?.code ?? '').toUpperCase();
  const message = (context?.message ?? (error instanceof Error ? error.message : '') ?? '').toLowerCase();

  if (context?.approvalOutcome && ['rejected', 'timeout'].includes(context.approvalOutcome)) return 'APPROVAL_ERROR';
  if (context?.budgetExhausted || code === 'BUDGET_EXCEEDED' || /budget|spent|cost/i.test(message)) return 'COST_LIMIT';
  if (context?.permissionDenied || code === 'PERMISSION_DENIED' || /permission|not allowed/i.test(message)) return 'PERMISSION_ERROR';
  if (code === 'APPROVAL_REJECTED' || code === 'APPROVAL_TIMEOUT') return 'APPROVAL_ERROR';
  if (code === 'POLICY_BLOCK' || /policy|autonomy.?level/i.test(message)) return 'POLICY_BLOCK';
  if (code === 'USER_AMBIGUITY' || /ambiguous|clarif/i.test(message)) return 'USER_AMBIGUITY';
  if (code === 'TOOL_ERROR' || /tool|function.?call/i.test(message)) return 'TOOL_ERROR';
  if (code === 'PROVIDER_ERROR' || /provider|api.?key|unauthorized|401|403/i.test(message)) return 'PROVIDER_ERROR';
  if (code === 'TIMEOUT' || /timeout|timed.?out|deadline/i.test(message)) return 'TIMEOUT';
  if (code === 'BAD_CONTEXT' || /context|not.?found|missing/i.test(message)) return 'BAD_CONTEXT';
  if (code === 'BAD_MEMORY' || /memory|retrieval/i.test(message)) return 'BAD_MEMORY';
  if (code === 'REASONING_ERROR' || /reasoning|max.?tokens|incomplete|truncated/i.test(message)) return 'REASONING_ERROR';
  if (context?.userInterventionRequired) return 'USER_AMBIGUITY';
  return 'UNKNOWN';
}
