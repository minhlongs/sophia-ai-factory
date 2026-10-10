/**
 * @module forest/agent-chat/executor/tool-executor
 * Tool Executor dispatcher — implements IToolExecutor for Sophia's agent chat.
 */

import { createLogger } from '@/seed/utils/logger-utility';
import { getBalance } from '@/tree/mcu/credits-repo';
import {
  AgentToolName,
  type AgentToolDefinition,
  type AgentToolResult,
  type IToolExecutor,
  toolError,
} from './types';
import {
  executeGetCampaigns,
  executeGetCampaignDetail,
  executeCreateCampaign,
  executeCancelCampaign,
} from './campaign-handlers';
import {
  executeListVideoModels,
  executeListVoiceModels,
  executeSearchMedia,
  executeGetCreditBalance,
  executeGetChatHistory,
} from './media-handlers';

const logger = createLogger('tool-executor');

/**
 * Sophia Tool Executor — implements IToolExecutor with real business logic.
 */
export class SophiaToolExecutor implements IToolExecutor {
  private userId: string | null = null;

  /** Set the current user context for tool execution */
  setUser(userId: string): void {
    this.userId = userId;
  }

  async execute(
    name: AgentToolName,
    args: Record<string, unknown>,
    userId: string,
  ): Promise<AgentToolResult> {
    this.setUser(userId);
    const start = Date.now();

    try {
      let result: AgentToolResult;
      switch (name) {
        case AgentToolName.GetCampaigns:
          result = await executeGetCampaigns(userId, args);
          break;
        case AgentToolName.GetCampaignDetail:
          result = await executeGetCampaignDetail(userId, args);
          break;
        case AgentToolName.CreateCampaign:
          result = await executeCreateCampaign(userId, args);
          break;
        case AgentToolName.CancelCampaign:
          result = await executeCancelCampaign(userId, args);
          break;
        case AgentToolName.ListVideoModels:
          result = await executeListVideoModels(userId);
          break;
        case AgentToolName.ListVoiceModels:
          result = await executeListVoiceModels(userId);
          break;
        case AgentToolName.SearchMedia:
          result = await executeSearchMedia(userId, args);
          break;
        case AgentToolName.GetCreditBalance:
          result = await executeGetCreditBalance(userId);
          break;
        case AgentToolName.GetChatHistory:
          result = await executeGetChatHistory(userId, args);
          break;
        default:
          return toolError(`Unknown tool: ${name}`);
      }

      const elapsed = Date.now() - start;
      logger.debug('Tool execution completed', { name, elapsed, success: result.success });
      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      logger.error('Tool execution error', { name, error: message });
      return toolError(message);
    }
  }

  listTools(): AgentToolDefinition[] {
    return [];
  }

  async isAvailable(_name: AgentToolName, userId: string): Promise<boolean> {
    const balance = await getBalance(userId).catch(() => null);
    return balance !== null && balance.credits_remaining > 0;
  }
}
