/**
 * Mission Command Registry — 18 AI Commands
 *
 * Defines all commands available via POST /api/v1/missions.
 * Each entry specifies credit cost and live/beta status.
 *
 * LIVE = real implementation via integrated provider
 * BETA = stub returning realistic mock data (upgrade_path comment included in result)
 */

import { EXTENDED_COMMANDS } from './command-definitions-extended';

export type CommandStatus = 'live' | 'beta';

export interface CommandDefinition {
  /** MCU credits charged per execution (0 = free) */
  credits: number;
  /** 'live' uses real integrations; 'beta' returns stubs */
  status: CommandStatus;
  /** Human-readable description */
  description: string;
}

export const COMMANDS: Record<string, CommandDefinition> = {
  'ai:write': {
    credits: 1,
    status: 'live',
    description: 'Generate SOP-ready scripts, captions, hashtags, and copy blocks',
  },
  'social:publish': {
    credits: 1,
    status: 'live',
    description: 'Schedule a video or content asset to connected distribution channels',
  },
  'video:create': {
    credits: 5,
    status: 'live',
    description: 'Create an AI avatar video via HeyGen',
  },
  'video:create_heygen': {
    credits: 5,
    status: 'live',
    description: 'Legacy alias for video:create via HeyGen',
  },
  'video:status': {
    credits: 0,
    status: 'live',
    description: 'Check video generation status',
  },
  'proposal:create': {
    credits: 3,
    status: 'live',
    description: 'Generate a business proposal using LLM',
  },
  'proposal:list': {
    credits: 0,
    status: 'live',
    description: 'List saved proposals',
  },
  'lead:find': {
    credits: 2,
    status: 'live',
    description: 'Find leads matching a niche via Apollo.io People Search (BYOK; stub fallback)',
  },
  'lead:enrich': {
    credits: 1,
    status: 'live',
    description: 'Enrich a lead via Hunter.io email-finder + verifier (BYOK; stub fallback)',
  },
  'lead:export': {
    credits: 1,
    status: 'live',
    description: 'Export leads to CSV via Apollo.io bulk search (BYOK; stub fallback)',
  },
  ...EXTENDED_COMMANDS,
} as const;

/**
 * Check if a command exists in the registry.
 */
export function isValidCommand(command: string): boolean {
  return command in COMMANDS;
}

/**
 * Get command definition or undefined if not found.
 */
export function getCommand(command: string): CommandDefinition | undefined {
  return COMMANDS[command];
}
