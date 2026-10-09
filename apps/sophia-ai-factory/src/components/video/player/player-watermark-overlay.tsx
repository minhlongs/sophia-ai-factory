'use client';

/**
 * Adaptive Video Player Forensic Watermark Overlay
 *
 * Layer: tree/forest presentation component
 *
 * @module components/video/player/player-watermark-overlay
 */

import React from 'react';
import { ShieldCheck } from 'lucide-react';

export interface ForensicWatermarkData {
  overlayText: string;
  opacity: number;
}

export interface PlayerWatermarkOverlayProps {
  watermark: ForensicWatermarkData;
  enableForensicWatermark?: boolean;
}

export function PlayerWatermarkOverlay({
  watermark,
  enableForensicWatermark = true,
}: PlayerWatermarkOverlayProps) {
  if (!enableForensicWatermark) return null;

  return (
    <div
      className="pointer-events-none absolute bottom-14 right-4 z-20 select-none rounded-md px-2.5 py-1 text-xs font-mono font-medium backdrop-blur-sm transition-all duration-300"
      style={{
        backgroundColor: `rgba(0, 0, 0, ${watermark.opacity * 0.6})`,
        color: `rgba(255, 255, 255, ${Math.max(0.4, watermark.opacity + 0.2)})`,
        borderColor: `rgba(255, 255, 255, ${watermark.opacity * 0.4})`,
        borderWidth: '1px',
      }}
      aria-hidden="true"
    >
      <div className="flex items-center gap-1.5">
        <ShieldCheck className="h-3 w-3 opacity-80" />
        <span>{watermark.overlayText}</span>
      </div>
    </div>
  );
}
