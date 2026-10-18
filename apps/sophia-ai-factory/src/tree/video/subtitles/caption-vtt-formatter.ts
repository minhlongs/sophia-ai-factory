/**
 * Caption Keyword Configuration & WebVTT Formatter.
 */

import type { SubtitleTrackSpec, WordAnimation } from './subtitle-types';

export const HIGH_CONVERTING_KEYWORDS: Record<
  string,
  { color: string; emoji: string; animation: WordAnimation }
> = {
  // Financial & Revenue
  money: { color: '#00FF66', emoji: '💰', animation: 'bounce' },
  cash: { color: '#00FF66', emoji: '💵', animation: 'bounce' },
  profit: { color: '#00FF66', emoji: '📈', animation: 'pop_scale' },
  revenue: { color: '#00FF66', emoji: '💎', animation: 'pop_scale' },
  payout: { color: '#FFD700', emoji: '🏦', animation: 'pop_scale' },
  rich: { color: '#FFD700', emoji: '🤑', animation: 'bounce' },
  dollar: { color: '#00FF66', emoji: '💲', animation: 'pop_scale' },

  // Urgency & Tech
  ai: { color: '#00E5FF', emoji: '🤖', animation: 'glow' },
  secret: { color: '#FF0055', emoji: '🤫', animation: 'glow' },
  hack: { color: '#FF0055', emoji: '⚡', animation: 'pop_scale' },
  free: { color: '#FFE600', emoji: '🎁', animation: 'bounce' },
  fast: { color: '#FFE600', emoji: '🚀', animation: 'pop_scale' },
  viral: { color: '#FF007F', emoji: '🔥', animation: 'pop_scale' },
  stop: { color: '#FF0033', emoji: '🛑', animation: 'pop_scale' },

  // Crypto specifics
  crypto: { color: '#F7931A', emoji: '₿', animation: 'pop_scale' },
  bitcoin: { color: '#F7931A', emoji: '🪙', animation: 'glow' },
  solana: { color: '#9945FF', emoji: '⚡', animation: 'pop_scale' },
  airdrop: { color: '#00FFCC', emoji: '🪂', animation: 'bounce' },
  breakout: { color: '#00FF66', emoji: '🚀', animation: 'pop_scale' },
};

export function formatSubtitlesToVTT(spec: SubtitleTrackSpec): string {
  const lines: string[] = ['WEBVTT', ''];

  for (const chunk of spec.chunks) {
    const formatTime = (sec: number) => {
      const minutes = Math.floor(sec / 60);
      const seconds = Math.floor(sec % 60);
      const ms = Math.floor((sec % 1) * 1000);
      return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${String(ms).padStart(3, '0')}`;
    };

    lines.push(
      `${formatTime(chunk.startTimeSeconds)} --> ${formatTime(chunk.endTimeSeconds)}`
    );

    const formattedText = chunk.words
      .map((w) => (w.emojiBadge ? `${w.word} ${w.emojiBadge}` : w.word))
      .join(' ');

    lines.push(formattedText);
    lines.push('');
  }

  return lines.join('\n');
}
