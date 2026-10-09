'use client';

/**
 * White-Label Client Portal Types
 *
 * Layer: land (Client Component Types)
 *
 * @module app/[locale]/portal/[agencySlug]/components/portal-types
 */

import type { UnbrandedAgencyPortalConfig } from '@/tree/partners/whitelabel-portal';

export type PortalTab = 'overview' | 'campaigns' | 'studio' | 'support';

export type VideoAspectRatio = '9:16' | '16:9' | '1:1';

export interface VideoDeliverable {
  id: string;
  title: string;
  platform: 'TikTok' | 'YouTube Shorts' | 'Reels';
  duration: string;
  aspectRatio: VideoAspectRatio;
  status: 'ready' | 'rendering' | 'review';
  createdAt: string;
  thumbnailColor: string;
}

export interface PortalClientProps {
  agency: UnbrandedAgencyPortalConfig;
  locale: string;
  isVi: boolean;
}
