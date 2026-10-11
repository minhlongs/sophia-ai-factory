'use client';

/**
 * Harness Health Test Helpers & Icons
 * Layer: app/[locale]/dashboard/system-health/components/harness-health
 */

import React from 'react';
import { Shield, Database, HardDrive, Cpu, Mic, Video, Film } from 'lucide-react';

export function TestIcon({ name }: { name: string }) {
  switch (name) {
    case 'd1_ping':
      return <Database className="w-4 h-4" aria-hidden="true" />;
    case 'r2_storage':
      return <HardDrive className="w-4 h-4" aria-hidden="true" />;
    case 'api_openrouter':
      return <Cpu className="w-4 h-4" aria-hidden="true" />;
    case 'api_elevenlabs':
      return <Mic className="w-4 h-4" aria-hidden="true" />;
    case 'api_heygen':
      return <Video className="w-4 h-4" aria-hidden="true" />;
    case 'remotion_render':
      return <Film className="w-4 h-4" aria-hidden="true" />;
    default:
      return <Shield className="w-4 h-4" aria-hidden="true" />;
  }
}

export const TEST_DISPLAY_NAME: Record<string, string> = {
  d1_ping: 'D1 Database',
  r2_storage: 'R2 Storage',
  api_openrouter: 'OpenRouter API',
  api_elevenlabs: 'ElevenLabs API',
  api_heygen: 'HeyGen API',
  remotion_render: 'Remotion Render',
};
