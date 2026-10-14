/**
 * Provider Health Probe Endpoints & Result Contracts.
 *
 * Defines lightweight upstream probe targets and result structures.
 *
 * @module tree/byok/provider-probe-endpoints
 */

import type { ProviderHealthStatus } from '@/tree/byok/provider-health-checker';

export interface ProbeTarget {
  url: string;
  method: 'GET' | 'POST';
  headers: (k: string) => Record<string, string>;
}

export const PROBE_TARGETS: Record<string, ProbeTarget> = {
  'fal-ai': {
    url: 'https://queue.fal.run/',
    method: 'GET',
    headers: (k) => ({ Authorization: `Key ${k}` }),
  },
  openrouter: {
    url: 'https://openrouter.ai/api/v1/auth/key',
    method: 'GET',
    headers: (k) => ({ Authorization: `Bearer ${k}` }),
  },
  elevenlabs: {
    url: 'https://api.elevenlabs.io/v1/user',
    method: 'GET',
    headers: (k) => ({ 'xi-api-key': k }),
  },
  'd-id': {
    url: 'https://api.d-id.com/credits',
    method: 'GET',
    headers: (k) => ({
      Authorization: `Basic ${k.includes(':') ? Buffer.from(k, 'utf-8').toString('base64') : k.replace(/^Basic\s+/i, '')}`,
    }),
  },
  heygen: {
    url: 'https://api.heygen.com/v2/voices?limit=1',
    method: 'GET',
    headers: (k) => ({ 'X-Api-Key': k, accept: 'application/json' }),
  },
  anthropic: {
    url: 'https://api.anthropic.com/v1/models',
    method: 'GET',
    headers: (k) => ({ 'x-api-key': k, 'anthropic-version': '2023-06-01' }),
  },
  muapi: {
    url: 'https://api.muapi.ai/v1/account',
    method: 'GET',
    headers: (k) => ({ Authorization: `Bearer ${k}` }),
  },
  replicate: {
    url: 'https://api.replicate.com/v1/account',
    method: 'GET',
    headers: (k) => ({ Authorization: `Bearer ${k}` }),
  },
};

export interface ProbeResult {
  ok: boolean;
  valid: boolean;
  provider: string;
  status: ProviderHealthStatus;
  latencyMs: number;
  message: string;
  message_vi: string;
  maskedKey: string;
  httpStatus?: number;
}
