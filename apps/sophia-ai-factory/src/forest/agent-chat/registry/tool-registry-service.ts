/**
 * Tool Registry Service
 * @module forest/agent-chat/registry/tool-registry-service
 */

import { createLogger } from '@/seed/utils/logger-utility';
import { AgentToolName, type AgentToolDefinition, type IToolExecutor, type AgentToolResult } from './types';
import { DEFAULT_AGENT_TOOLS } from './tool-catalog';

const logger = createLogger('tool-registry');

/**
 * Central registry of all agent tools.
 * Maps tool names to their definitions and provides discovery.
 */
export class ToolRegistry {
  private readonly tools: Map<AgentToolName, AgentToolDefinition>;
  private readonly executor: IToolExecutor;
  private readonly logger = logger;

  constructor(executor: IToolExecutor) {
    this.executor = executor;
    this.tools = new Map();
    this.registerDefaults();
  }

  /** Get tool definition by name */
  getDefinition(name: AgentToolName): AgentToolDefinition | undefined {
    return this.tools.get(name);
  }

  /** Get all tool definitions */
  getAllDefinitions(): AgentToolDefinition[] {
    return Array.from(this.tools.values());
  }

  /** Get tool definitions formatted for LLM provider (OpenAI-compatible) */
  getOpenAITools(): Array<{ type: 'function'; function: { name: string; description: string; parameters: Record<string, unknown> } }> {
    return this.getAllDefinitions().map((def) => ({
      type: 'function' as const,
      function: {
        name: def.name,
        description: def.description,
        parameters: def.inputSchema,
      },
    }));
  }

  /** Get tool definitions formatted for Anthropic Messages API */
  getAnthropicTools(): Array<{ name: string; description: string; input_schema: Record<string, unknown> }> {
    return this.getAllDefinitions().map((def) => ({
      name: def.name,
      description: def.description,
      input_schema: def.inputSchema,
    }));
  }

  /** Execute a tool by name */
  async execute(name: string, args: Record<string, unknown>, userId: string): Promise<AgentToolResult> {
    const toolName = AgentToolName[name as keyof typeof AgentToolName];
    if (!toolName || !this.tools.has(toolName)) {
      return {
        success: false,
        content: `Unknown tool: ${name}`,
        error: `Tool "${name}" is not registered`,
        isInternal: false,
      };
    }

    const definition = this.tools.get(toolName)!;
    this.logger.debug('Executing tool', { name: toolName, userId });

    try {
      const available = await this.executor.isAvailable(toolName, userId);
      if (!available) {
        return {
          success: false,
          content: `Tool "${definition.name}" is not available for your account.`,
          error: 'Tool not available',
          isInternal: false,
        };
      }

      const result = await this.executor.execute(toolName, args, userId);
      this.logger.debug('Tool executed', { name: toolName, success: result.success });
      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      this.logger.error('Tool execution failed', { name: toolName, error: message });
      return {
        success: false,
        content: `Tool execution failed: ${message}`,
        error: message,
        isInternal: false,
      };
    }
  }

  /** Estimate total description token count for all tools */
  getTotalDescriptionTokens(): number {
    return this.getAllDefinitions().reduce((sum, def) => sum + def.descriptionTokens, 0);
  }

  private registerDefaults(): void {
    for (const def of DEFAULT_AGENT_TOOLS) {
      this.tools.set(def.name, def);
    }
  }
}
