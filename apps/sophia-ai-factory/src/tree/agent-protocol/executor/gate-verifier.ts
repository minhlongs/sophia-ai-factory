import type { AgentDefinition, AgentContext } from '@/seed/types/creative-domain';
import { isActionAllowed, checkActionAllowed } from '@/tree/autonomy/autonomy-repo';
import { success, failure, type Result } from '@/seed/types/result';
import { logger } from '@/seed/utils/logger-utility';
import { ExecutorError } from './types';

/**
 * Autonomy gate for one action. When the context carries a resolved
 * per-mission-type policy (AgentContext.effectivePolicy) the decision is made
 * synchronously from its stored level; otherwise the legacy workspace-level
 * gate is consulted, preserving prior behavior byte-for-byte.
 */
export async function isGateAllowed(
  context: AgentContext,
  agentId: string,
  actionType: string,
): Promise<boolean> {
  const policy = context.effectivePolicy;
  if (policy) {
    return checkActionAllowed(policy.storedLevel, actionType);
  }
  return isActionAllowed(context.workspaceId, actionType, agentId);
}

/**
 * Verify that all required tool permissions and approvals are satisfied.
 */
export async function verifyAgentPermissions(
  definition: AgentDefinition,
  context: AgentContext,
): Promise<Result<true, ExecutorError>> {
  const correlationId = context.correlationId;
  const approvedActionIds = new Set(context.approvedActionIds ?? []);

  for (const permission of definition.permissions) {
    const allowed = await isGateAllowed(context, definition.id, permission.tool);
    if (!allowed) {
      logger.warn('[AgentExecutor] tool permission denied', {
        correlationId,
        tool: permission.tool,
        agentId: definition.id,
      });
      return failure(
        new ExecutorError(
          'AUTONOMY_DENIED',
          `Tool ${permission.tool} is not allowed for workspace ${context.workspaceId}`,
        ),
      );
    }
    if (permission.requiresApproval && !approvedActionIds.has(permission.tool)) {
      logger.warn('[AgentExecutor] approval required but missing', {
        correlationId,
        tool: permission.tool,
        agentId: definition.id,
      });
      return failure(
        new ExecutorError(
          'AUTONOMY_DENIED',
          `Tool ${permission.tool} requires approval that is not present in context`,
        ),
      );
    }
  }
  return success(true);
}
