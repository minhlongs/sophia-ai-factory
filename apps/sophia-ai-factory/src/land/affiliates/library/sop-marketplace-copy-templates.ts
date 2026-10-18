import type { CopyTemplate } from './types';

export const SOP_MARKETPLACE_COPY_TEMPLATES: readonly CopyTemplate[] = [
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
  {
    id: 'facebook-sop-marketplace-en',
    niche: 'sop_marketplace',
    locale: 'en',
    channel: 'facebook',
    body: `Hey everyone 👋\n\nI just published a new SOP on Sophia AI Factory — "{{SOP_NAME}}".\n\nThis playbook covers exactly how I [brief outcome — e.g. "cut client onboarding from 3 days to 4 hours"]. It's plug-and-play: download, customise your details, run it.\n\nIf you've been building your own systems for this, save yourself the rework. Link: {{REF_LINK}}\n\nHappy to answer questions below!`,
    minTier: 'BASIC',
  },
  {
    id: 'reddit-sop-marketplace-en',
    niche: 'sop_marketplace',
    locale: 'en',
    channel: 'reddit',
    body: `**I packaged 2 years of trial-and-error into a single SOP — sharing it on Sophia's marketplace**\n\nAfter running [your use-case] for two years I finally wrote down every decision point, tool, and failure mode into a single document: "{{SOP_NAME}}".\n\nIt covers:\n- [Key step 1]\n- [Key step 2]\n- [Key step 3]\n\nI put it in the Sophia AI Factory marketplace so it's versioned and easy to update. Not a free doc — priced it to filter for people who'll actually use it.\n\nFull details + preview: {{REF_LINK}}\n\nHappy to answer questions in comments.`,
    minTier: 'PREMIUM',
  },
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
