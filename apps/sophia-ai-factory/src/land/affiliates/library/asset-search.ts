import type { CopyTemplate } from './types';
import { SOP_MARKETPLACE_COPY_TEMPLATES } from './sop-marketplace-copy-templates';

export { OUTREACH_SCRIPTS } from './outreach-scripts';

export const COPY_TEMPLATES: readonly CopyTemplate[] = [
  // Universal — BASIC tier
  {
    id: 'twitter-universal-en',
    niche: 'universal',
    locale: 'en',
    channel: 'twitter',
    body: 'Tired of burning hours on AI video tools that ship slop? Sophia AI Factory turns 1 brief into 10 channel-ready clips. Free trial, no credit card: {{REF_LINK}}',
    minTier: 'BASIC',
  },
  {
    id: 'twitter-universal-vi',
    niche: 'universal',
    locale: 'vi',
    channel: 'twitter',
    body: 'Một brief, mười clip ready-to-post. Sophia tự dựng video + dàn dòng + đẩy đa kênh, không tốn editor. Thử miễn phí: {{REF_LINK}}',
    minTier: 'BASIC',
  },
  {
    id: 'linkedin-universal-en',
    niche: 'universal',
    locale: 'en',
    channel: 'linkedin',
    body: 'I cut my client video pipeline from 6h to 18min using Sophia AI Factory. One workflow handles brief → script → render → publish. If you bill creative hours, this changes the math. {{REF_LINK}}',
    minTier: 'BASIC',
  },
  // Creators niche — PREMIUM
  {
    id: 'tiktok-creators-en',
    niche: 'creators',
    locale: 'en',
    channel: 'tiktok-caption',
    body: 'POV: you stopped editing at 2am because AI does your B-roll, captions, and cuts. Sophia is the unfair stack: {{REF_LINK}} #creatortools',
    minTier: 'PREMIUM',
  },
  {
    id: 'instagram-creators-vi',
    niche: 'creators',
    locale: 'vi',
    channel: 'instagram',
    body: 'Stop dựng video một mình. Sophia render hộ B-roll + caption + cắt cảnh, deadline 1 ngày làm 10 video không vấn đề. Link tool: {{REF_LINK}}',
    minTier: 'PREMIUM',
  },
  // Agency niche — ENTERPRISE
  {
    id: 'linkedin-agency-en',
    niche: 'agency',
    locale: 'en',
    channel: 'linkedin',
    body: 'Agency owners: stop billing $80/hr to render. Sophia runs your 10-deliverable monthly retainer in one afternoon. White-label and tiered pricing live. Audit your margins → {{REF_LINK}}',
    minTier: 'ENTERPRISE',
  },
  // Coaches niche — PREMIUM
  {
    id: 'twitter-coaches-en',
    niche: 'coaches',
    locale: 'en',
    channel: 'twitter',
    body: '47 short videos a month is the new minimum if you want clients. Sophia produces them while you coach. Same brief, ten variants. {{REF_LINK}}',
    minTier: 'PREMIUM',
  },
  // Dropshippers niche — PREMIUM
  {
    id: 'tiktok-dropshippers-en',
    niche: 'dropshippers',
    locale: 'en',
    channel: 'tiktok-caption',
    body: 'Test 20 winning angles in a weekend. Sophia spits product videos in batches — you focus on creatives that print. {{REF_LINK}}',
    minTier: 'PREMIUM',
  },
  ...SOP_MARKETPLACE_COPY_TEMPLATES,
];
