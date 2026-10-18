/**
 * Extended Mission Command Definitions (Distribution, Voice, Avatar, Campaigns, Analytics)
 *
 * @module tree/missions/command-definitions-extended
 */

import type { CommandDefinition } from './command-registry';

export const EXTENDED_COMMANDS: Record<string, CommandDefinition> = {
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
