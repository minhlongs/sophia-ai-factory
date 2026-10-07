/**
 * Compliance Overlay Types for Video Rendering.
 * Specifies disclaimer positioning, opacity, font size, and regulatory notice texts.
 */

import type { VideoNiche } from '@/seed/config/video-blueprints/blueprint-types';

export interface ComplianceOverlaySpec {
  niche: VideoNiche;
  jurisdiction: string;
  isAllowed: boolean;
  disclaimerText: string;
  subDisclaimerText?: string;
  ftcBadgeText: string;
  regulatoryRef?: string;
  position: 'bottom_bar' | 'top_banner' | 'end_card';
  opacity: number;
  fontSizePx: number;
  displayStartSecond: number;
  displayDurationSecond: number;
}

export interface ComplianceOverlayInput {
  niche: VideoNiche;
  hasFinancialClaim: boolean;
  hasAffiliateLink: boolean;
  targetJurisdiction?: string;
}
