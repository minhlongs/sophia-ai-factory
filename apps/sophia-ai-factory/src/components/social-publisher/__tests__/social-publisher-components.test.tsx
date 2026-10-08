/**
 * Social Publisher UI Components Vitest Suite
 * Verifies rendering of Safe-Zone player, Channel credentials grid, and Cockpit.
 *
 * Layer: UI Test | Zero :any.
 * @module components/social-publisher/__tests__/social-publisher-components.test
 */

import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { VerticalSafeZonePlayer } from '../vertical-safe-zone-player';
import { ChannelCredentialsGrid, type ChannelCardData } from '../channel-credentials-grid';
import { SocialPublisherCockpit } from '../social-publisher-cockpit';

describe('Social Publisher UI Components', () => {
  describe('VerticalSafeZonePlayer', () => {
    it('renders placeholder state when no video URL is provided', () => {
      const handlePlatformChange = vi.fn();
      render(
        <VerticalSafeZonePlayer
          activePlatform="TIKTOK_V2"
          onPlatformChange={handlePlatformChange}
          title="Thử nghiệm video 9:16"
          caption="#growth #ai"
        />,
      );

      expect(screen.getByText('Thử nghiệm video 9:16')).toBeDefined();
      expect(screen.getByText('Safe 9:16')).toBeDefined();
      expect(screen.getByText('TikTok')).toBeDefined();
    });

    it('toggles safe zone guides on and off', () => {
      const handlePlatformChange = vi.fn();
      render(
        <VerticalSafeZonePlayer
          activePlatform="YOUTUBE_SHORTS"
          onPlatformChange={handlePlatformChange}
        />,
      );

      const toggleBtn = screen.getByText('Safe 9:16');
      fireEvent.click(toggleBtn);
      expect(screen.getByText('Raw')).toBeDefined();
    });
  });

  describe('ChannelCredentialsGrid', () => {
    const mockChannels: ChannelCardData[] = [
      {
        platform: 'YOUTUBE_SHORTS',
        channelId: 'yt_123',
        channelName: 'Alpha Shorts',
        connected: true,
        status: 'HEALTHY',
        dailyPostsUsed: 2,
        dailyPostsMax: 10,
        tokenExpiresAt: Date.now() + 86400000 * 5,
        killSwitchActive: false,
      },
      {
        platform: 'TIKTOK_V2',
        channelId: 'tt_456',
        channelName: 'Beta TikTok',
        connected: true,
        status: 'KILL_SWITCH_ACTIVE',
        dailyPostsUsed: 4,
        dailyPostsMax: 8,
        tokenExpiresAt: Date.now() + 86400000,
        killSwitchActive: true,
      },
    ];

    it('renders channel cards with status badges and daily quota', () => {
      render(<ChannelCredentialsGrid channels={mockChannels} />);

      expect(screen.getByText('Alpha Shorts')).toBeDefined();
      expect(screen.getByText('Beta TikTok')).toBeDefined();
      expect(screen.getByText('Khóa dừng / Locked')).toBeDefined();
      expect(screen.getByText('Hoạt động / Ready')).toBeDefined();
    });

    it('triggers kill switch toggle callback when clicked', () => {
      const handleKillSwitch = vi.fn();
      render(
        <ChannelCredentialsGrid
          channels={mockChannels}
          onToggleKillSwitch={handleKillSwitch}
        />,
      );

      const lockButtons = screen.getAllByRole('button', { name: /Dừng \/ Lock|Bật lại \/ Unlock/i });
      fireEvent.click(lockButtons[0]);
      expect(handleKillSwitch).toHaveBeenCalledWith('yt_123', false);
    });
  });

  describe('SocialPublisherCockpit', () => {
    it('renders dispatch form and handles validation errors', async () => {
      render(<SocialPublisherCockpit />);

      expect(screen.getByText('Xuất Bản Đa Kênh Trực Tiếp')).toBeDefined();
      const submitBtn = screen.getByRole('button', { name: /Xuất Bản Ngẫu Nhiên/i });
      fireEvent.click(submitBtn);

      expect(await screen.findByText(/Vui lòng nhập tiêu đề video/i)).toBeDefined();
    });
  });
});
