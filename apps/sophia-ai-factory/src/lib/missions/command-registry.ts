/**
 * Mission Command Registry — 17 AI Commands
 *
 * Defines all commands available via POST /api/v1/missions.
 * Each entry specifies credit cost and live/beta status.
 *
 * LIVE = real implementation via integrated provider
 * BETA = stub returning realistic mock data (upgrade_path comment included in result)
 */

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
  'video:create': {
    credits: 5,
    status: 'live',
    description: 'Create an AI avatar video via HeyGen',
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
    status: 'beta',
    description: 'Find leads matching a niche (stub — Apollo.io integration pending)',
  },
  'lead:enrich': {
    credits: 1,
    status: 'beta',
    description: 'Enrich lead data (stub — Hunter.io integration pending)',
  },
  'lead:export': {
    credits: 1,
    status: 'beta',
    description: 'Export leads as CSV (stub)',
  },
  'email:campaign': {
    credits: 5,
    status: 'live',
    description: 'Send bulk email campaign via Resend',
  },
  'email:test': {
    credits: 0,
    status: 'live',
    description: 'Send a test email',
  },
  'email:templates': {
    credits: 0,
    status: 'live',
    description: 'List saved email templates',
  },
  'youtube:publish': {
    credits: 3,
    status: 'beta',
    description: 'Publish video to YouTube (stub if no OAuth creds)',
  },
  'youtube:list-channels': {
    credits: 0,
    status: 'beta',
    description: 'List connected YouTube channels',
  },
  'voice:clone': {
    credits: 10,
    status: 'beta',
    description: 'Clone a voice (stub — ElevenLabs integration pending)',
  },
  'subtitle:generate': {
    credits: 1,
    status: 'live',
    description: 'Generate SRT subtitles from audio via Whisper',
  },
  'campaign:run': {
    credits: 5,
    status: 'live',
    description: 'Run a full lead-find → email-campaign pipeline',
  },
  'analytics:report': {
    credits: 1,
    status: 'live',
    description: 'Generate usage + mission analytics report',
  },
  'webhook:test': {
    credits: 0,
    status: 'live',
    description: 'Ping your webhook URL to verify it responds',
  },
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
