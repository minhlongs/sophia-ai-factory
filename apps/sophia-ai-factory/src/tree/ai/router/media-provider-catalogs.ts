/**
 * Audio & Render Stage Provider Catalogs for Multimodal Cost Arbitrage Router
 *
 * Layer: tree/ai/router
 */

import type { StageProviderOption } from '@/seed/types/unit-economics-types';

export const AUDIO_PROVIDER_OPTIONS: StageProviderOption[] = [
  {
    provider: 'mekong',
    model: 'kokoro-tts-v0.19',
    unitCostUsd: 0.0,
    unitDescription: 'Unmetered Local Edge Neural TTS',
    isUnmetered: true,
    latencyAvgMs: 350,
  },
  {
    provider: 'elevenlabs',
    model: 'eleven_flash_v2_5',
    unitCostUsd: 0.000015, // $0.015 per 1K chars
    unitDescription: '$0.000015 per char (Flash)',
    isUnmetered: false,
    latencyAvgMs: 450,
  },
  {
    provider: 'elevenlabs',
    model: 'eleven_turbo_v2_5',
    unitCostUsd: 0.00003, // $0.030 per 1K chars
    unitDescription: '$0.000030 per char (Turbo)',
    isUnmetered: false,
    latencyAvgMs: 650,
  },
  {
    provider: 'elevenlabs',
    model: 'eleven_multilingual_v2',
    unitCostUsd: 0.00003, // $0.030 per 1K chars
    unitDescription: '$0.000030 per char (Multilingual HQ)',
    isUnmetered: false,
    latencyAvgMs: 900,
  },
];

export const RENDER_PROVIDER_OPTIONS: StageProviderOption[] = [
  {
    provider: 'mekong',
    model: 'ffmpeg-hw-apple-silicon',
    unitCostUsd: 0.0,
    unitDescription: 'Unmetered VideoToolbox HW Encoding',
    isUnmetered: true,
    latencyAvgMs: 800,
  },
  {
    provider: 'openrouter', // Worker composition proxy
    model: 'cloudflare-worker-ffmpeg',
    unitCostUsd: 0.005, // $0.005 flat video composition compute
    unitDescription: '$0.005 flat cloud worker stitching',
    isUnmetered: false,
    latencyAvgMs: 1500,
  },
  {
    provider: 'fal',
    model: 'wan/wan-2-1-t2v',
    unitCostUsd: 0.15, // $0.15 per video second
    unitDescription: '$0.150 per second video synthesis',
    isUnmetered: false,
    latencyAvgMs: 6000,
  },
];
