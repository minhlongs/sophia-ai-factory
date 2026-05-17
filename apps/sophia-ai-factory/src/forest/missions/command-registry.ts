/**
 * Mission Command Registry — 18 AI Commands
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
    status: 'live',
    description: 'Publish video to a specific YouTube channel (multi-account; channel_id required)',
  },
  'youtube:list-channels': {
    credits: 0,
    status: 'live',
    description: 'List all connected YouTube channels with their publishing_channels.id',
  },
  'voice:clone': {
    credits: 10,
    status: 'live',
    description: 'Clone a voice via ElevenLabs Instant Voice Cloning (BYOK + sample_urls required)',
  },
  'avatar:create-did': {
    credits: 8,
    status: 'live',
    description: 'Generate a talking avatar video via D-ID (BYOK D-ID key required)',
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
