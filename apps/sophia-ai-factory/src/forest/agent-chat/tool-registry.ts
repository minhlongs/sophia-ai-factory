/**
 * @module forest/agent-chat/tool-registry
 *
 * Tool Registry — declarative tool definitions for the agent chat tool-use loop.
 *
 * Ported from Palmier Pro's ToolName enum + ToolDefinitions pattern,
 * adapted for Sophia's SaaS domain (video generation, campaign management, media operations).
 *
 * Import direction: forest → seed, tree (ONE-WAY).
 */

import { createLogger } from '@/seed/utils/logger-utility';

const logger = createLogger('tool-registry');

// ── Tool Names ─────────────────────────────────────────────────────────────────

/**
 * Available agent tools.
 * Each tool maps to a handler in ToolExecutor.
 */
export enum AgentToolName {
  /** Get current user's campaign list with status and progress */
  GetCampaigns = 'get_campaigns',
  /** Get detailed info for a specific campaign */
  GetCampaignDetail = 'get_campaign_detail',
  /** Create a new video generation campaign */
  CreateCampaign = 'create_campaign',
  /** Cancel or pause an active campaign */
  CancelCampaign = 'cancel_campaign',
  /** Get available AI video generation models */
  ListVideoModels = 'list_video_models',
  /** Get available AI voice/TTS models */
  ListVoiceModels = 'list_voice_models',
  /** Search user's media library */
  SearchMedia = 'search_media',
  /** Get user's credit balance and usage */
  GetCreditBalance = 'get_credit_balance',
  /** Get recent agent chat history */
  GetChatHistory = 'get_chat_history',
}

// ── Tool Definition ────────────────────────────────────────────────────────────

export interface AgentToolDefinition {
  /** Tool identifier — must match AgentToolName */
  name: AgentToolName;
  /** Human-readable description for the LLM */
  description: string;
  /** JSON Schema for tool input parameters */
  inputSchema: Record<string, unknown>;
  /** Whether this tool requires user authentication */
  requiresAuth: boolean;
  /** Estimated token cost for tool description (for context budgeting) */
  descriptionTokens: number;
}

// ── Tool Result ────────────────────────────────────────────────────────────────

export interface AgentToolResult {
  /** Whether the tool executed successfully */
  success: boolean;
  /** Result content — string for text, object/array for structured data */
  content: unknown;
  /** Error message if success is false */
  error?: string;
  /** Whether the result should be hidden from the user (internal) */
  isInternal: boolean;
}

// ── Tool Executor Contract ─────────────────────────────────────────────────────

/**
 * Tool Executor — executes agent tools and returns results.
 *
 * Implementations handle the actual business logic for each tool.
 * The registry dispatches to the appropriate executor method.
 */
export interface IToolExecutor {
  /** Execute a tool by name with the given arguments */
  execute(name: AgentToolName, args: Record<string, unknown>, userId: string): Promise<AgentToolResult>;
  /** List all available tool definitions */
  listTools(): AgentToolDefinition[];
  /** Check if a tool is available (auth, quota, etc.) */
  isAvailable(name: AgentToolName, userId: string): Promise<boolean>;
}

// ── Tool Definitions Registry ──────────────────────────────────────────────────

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

  // ── Private ────────────────────────────────────────────────────────────────

  private registerDefaults(): void {
    const defaults: AgentToolDefinition[] = [
      {
        name: AgentToolName.GetCampaigns,
        description: 'Get the current user\'s video generation campaigns. Returns campaign IDs, names, status (draft, queued, processing_script, processing_video, completed, failed), progress percentage, and creation dates.',
        inputSchema: {
          type: 'object',
          properties: {
            status: { type: 'string', enum: ['draft', 'queued', 'processing_script', 'processing_video', 'completed', 'failed'], description: 'Filter by status (optional)' },
            limit: { type: 'integer', minimum: 1, maximum: 50, description: 'Max campaigns to return (default 20)' },
          },
          required: [],
        },
        requiresAuth: true,
        descriptionTokens: 45,
      },
      {
        name: AgentToolName.GetCampaignDetail,
        description: 'Get detailed information about a specific campaign including script content, video URL, template used, progress history, and error messages if any.',
        inputSchema: {
          type: 'object',
          properties: {
            campaign_id: { type: 'string', description: 'The campaign ID to retrieve' },
          },
          required: ['campaign_id'],
        },
        requiresAuth: true,
        descriptionTokens: 40,
      },
      {
        name: AgentToolName.CreateCampaign,
        description: 'Create a new video generation campaign. Requires a script or topic, and optionally a template and target platform. Returns the created campaign ID.',
        inputSchema: {
          type: 'object',
          properties: {
            topic: { type: 'string', description: 'Video topic or description (used to generate script if no script provided)' },
            script: { type: 'string', description: 'Pre-written script (optional if topic provided)' },
            template_id: { type: 'string', description: 'Template ID for visual style (optional)' },
            target_platform: { type: 'string', enum: ['youtube', 'tiktok', 'instagram', 'facebook', 'generic'], description: 'Target platform for optimization' },
            voice_id: { type: 'string', description: 'Voice ID for TTS (optional)' },
          },
          required: ['topic'],
        },
        requiresAuth: true,
        descriptionTokens: 55,
      },
      {
        name: AgentToolName.CancelCampaign,
        description: 'Cancel or pause an active video generation campaign. Only campaigns in queued or processing status can be cancelled.',
        inputSchema: {
          type: 'object',
          properties: {
            campaign_id: { type: 'string', description: 'The campaign ID to cancel' },
          },
          required: ['campaign_id'],
        },
        requiresAuth: true,
        descriptionTokens: 30,
      },
      {
        name: AgentToolName.ListVideoModels,
        description: 'List available AI video generation models configured by the user. Shows model names, providers, and capabilities.',
        inputSchema: {
          type: 'object',
          properties: {},
          required: [],
        },
        requiresAuth: true,
        descriptionTokens: 25,
      },
      {
        name: AgentToolName.ListVoiceModels,
        description: 'List available AI voice/TTS models configured by the user. Shows voice names, providers, and supported languages.',
        inputSchema: {
          type: 'object',
          properties: {},
          required: [],
        },
        requiresAuth: true,
        descriptionTokens: 25,
      },
      {
        name: AgentToolName.SearchMedia,
        description: 'Search the user\'s media library (uploaded videos, images, audio). Returns matching assets with metadata.',
        inputSchema: {
          type: 'object',
          properties: {
            query: { type: 'string', description: 'Search query (filename, tag, or metadata)' },
            media_type: { type: 'string', enum: ['video', 'image', 'audio', 'all'], description: 'Filter by media type' },
            limit: { type: 'integer', minimum: 1, maximum: 50, description: 'Max results (default 10)' },
          },
          required: ['query'],
        },
        requiresAuth: true,
        descriptionTokens: 35,
      },
      {
        name: AgentToolName.GetCreditBalance,
        description: 'Get the current user\'s MCU credit balance, total credits purchased, and credits used this billing period.',
        inputSchema: {
          type: 'object',
          properties: {},
          required: [],
        },
        requiresAuth: true,
        descriptionTokens: 20,
      },
      {
        name: AgentToolName.GetChatHistory,
        description: 'Get recent agent chat conversation summaries for the current user. Returns conversation IDs, titles, and timestamps.',
        inputSchema: {
          type: 'object',
          properties: {
            limit: { type: 'integer', minimum: 1, maximum: 20, description: 'Max conversations (default 10)' },
          },
          required: [],
        },
        requiresAuth: true,
        descriptionTokens: 25,
      },
    ];

    for (const def of defaults) {
      this.tools.set(def.name, def);
    }
  }
}
