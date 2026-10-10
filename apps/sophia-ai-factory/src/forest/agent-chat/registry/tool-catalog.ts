/**
 * Default tool catalog definitions
 * @module forest/agent-chat/registry/tool-catalog
 */

import { AgentToolName, type AgentToolDefinition } from './types';

export const DEFAULT_AGENT_TOOLS: AgentToolDefinition[] = [
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
