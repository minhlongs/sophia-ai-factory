/**
 * Types and interfaces for Agent Tool Registry
 * @module forest/agent-chat/registry/types
 */

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

/**
 * Tool Executor — executes agent tools and returns results.
 */
export interface IToolExecutor {
  /** Execute a tool by name with the given arguments */
  execute(name: AgentToolName, args: Record<string, unknown>, userId: string): Promise<AgentToolResult>;
  /** List all available tool definitions */
  listTools(): AgentToolDefinition[];
  /** Check if a tool is available (auth, quota, etc.) */
  isAvailable(name: AgentToolName, userId: string): Promise<boolean>;
}
