import type { CopyTemplate } from './types';

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

  // SOP Marketplace — BASIC tier (Twitter/X)
  {
    id: 'twitter-sop-marketplace-en',
    niche: 'sop_marketplace',
    locale: 'en',
    channel: 'twitter',
    body: 'Just listed "{{SOP_NAME}}" on Sophia AI Factory marketplace 🚀\n\nOperational playbooks that actually ship — grab it here: {{REF_LINK}}\n\n#SOP #AItools #Automation',
    minTier: 'BASIC',
  },
  {
    id: 'twitter-sop-marketplace-vi',
    niche: 'sop_marketplace',
    locale: 'vi',
    channel: 'twitter',
    body: 'Vừa đăng "{{SOP_NAME}}" lên Sophia AI Factory marketplace.\n\nSOP thực chiến, ai dùng AI để scale doanh thu là cần cái này: {{REF_LINK}}\n\n#SOP #AI #TựĐộngHóa',
    minTier: 'BASIC',
  },

  // SOP Marketplace — BASIC tier (Facebook group)
  {
    id: 'facebook-sop-marketplace-en',
    niche: 'sop_marketplace',
    locale: 'en',
    channel: 'facebook',
    body: `Hey everyone 👋\n\nI just published a new SOP on Sophia AI Factory — "{{SOP_NAME}}".\n\nThis playbook covers exactly how I [brief outcome — e.g. "cut client onboarding from 3 days to 4 hours"]. It's plug-and-play: download, customise your details, run it.\n\nIf you've been building your own systems for this, save yourself the rework. Link: {{REF_LINK}}\n\nHappy to answer questions below!`,
    minTier: 'BASIC',
  },

  // SOP Marketplace — PREMIUM tier (Reddit r/entrepreneur)
  {
    id: 'reddit-sop-marketplace-en',
    niche: 'sop_marketplace',
    locale: 'en',
    channel: 'reddit',
    body: `**I packaged 2 years of trial-and-error into a single SOP — sharing it on Sophia's marketplace**\n\nAfter running [your use-case] for two years I finally wrote down every decision point, tool, and failure mode into a single document: "{{SOP_NAME}}".\n\nIt covers:\n- [Key step 1]\n- [Key step 2]\n- [Key step 3]\n\nI put it in the Sophia AI Factory marketplace so it's versioned and easy to update. Not a free doc — priced it to filter for people who'll actually use it.\n\nFull details + preview: {{REF_LINK}}\n\nHappy to answer questions in comments.`,
    minTier: 'PREMIUM',
  },

  // SOP Marketplace — BASIC tier (Telegram group)
  {
    id: 'telegram-sop-marketplace-en',
    niche: 'sop_marketplace',
    locale: 'en',
    channel: 'telegram',
    body: `📋 New SOP dropped: "{{SOP_NAME}}"\n\nIf you're still building this process from scratch, here's the shortcut 👇\n{{REF_LINK}}\n\nLive on Sophia AI Factory marketplace — instant download, plug-and-play.`,
    minTier: 'BASIC',
  },
  {
    id: 'telegram-sop-marketplace-vi',
    niche: 'sop_marketplace',
    locale: 'vi',
    channel: 'telegram',
    body: `📋 SOP mới vừa lên: "{{SOP_NAME}}"\n\nNếu bạn đang tự build quy trình này từ đầu — đây là phím tắt 👇\n{{REF_LINK}}\n\nĐã có trên Sophia AI Factory marketplace, tải về và dùng ngay.`,
    minTier: 'BASIC',
  },
];
