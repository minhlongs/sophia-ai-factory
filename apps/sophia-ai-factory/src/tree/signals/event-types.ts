/**
 * PostHog event type definitions + zod schemas
 * RED-TEAM #11: financial events marked _serverOnly: true — client capture refused
 */

import { z } from 'zod'

// ---- Event name enum ----
export const Events = {
  // Client-safe events
  SIGNUP: 'signup',
  PAGEVIEW: 'pageview',
  CTA_CLICK: 'cta_click',
  WIZARD_STEP: 'wizard_step',
  WIZARD_COMPLETED: 'wizard_completed',
  BYOK_CONFIGURED: 'byok_configured',
  CAMPAIGN_CREATED: 'campaign_created',
  CAMPAIGN_PUBLISHED: 'campaign_published',
  VIDEO_RENDERED: 'video_rendered',
  FIRST_VIDEO_STARTED: 'first_video_started',
  FIRST_VIDEO_COMPLETED: 'first_video_completed',
  // Experiment assignment events
  EXPERIMENT_ASSIGNED: 'experiment_assigned',
  // SOP / referral events

SOP_INSTALLED: 'sop_installed',
REFERRAL_SIGNUP: 'referral_signup',
// Server-only financial / usage events
