import type { OutreachScript } from './types';

export const OUTREACH_SCRIPTS: readonly OutreachScript[] = [
  {
    id: 'email-cold-creator-en',
    locale: 'en',
    channel: 'email',
    subject: 'Saw your last 3 reels — quick idea',
    body: `Hey {first_name},\n\nWatched your last 3 posts — your hook game is solid but the post cadence felt rough. I help creators like you cut editing time ~80% with Sophia AI Factory; a brief becomes 10 channel-ready clips.\n\nIf I'm right that you're posting <3x/week because of bandwidth, this fixes it. Free to try, my affiliate link if you wanna kick the tires: {{REF_LINK}}\n\nNo pressure either way.\n\n— {sender_name}`,
    minTier: 'PREMIUM',
  },
  {
    id: 'linkedin-dm-agency-en',
    locale: 'en',
    channel: 'linkedin-dm',
    body: `Hey {first_name}, saw your agency does retainer video work for {industry}. I run a similar shop — switched to Sophia AI Factory 2 months ago and shaved ~60% off our render costs. Worth a 10-min look if margins are tight: {{REF_LINK}}`,
    minTier: 'ENTERPRISE',
  },
  {
    id: 'email-coach-en',
    locale: 'en',
    channel: 'email',
    subject: 'Your daily content is the bottleneck — fix in 1 tool',
    body: `Hi {first_name},\n\nYou're a coach who lives or dies by daily content. Sophia turns a 5-min voice memo into a week of posts (script, visuals, captions, schedule). That alone is the unlock — but it also tracks which posts convert into discovery calls.\n\nI'm an affiliate so full transparency: {{REF_LINK}}. 14-day free trial, no card.\n\n— {sender_name}`,
    minTier: 'PREMIUM',
  },
  {
    id: 'email-sop-marketplace-beta-creator-en',
    niche: 'sop_marketplace',
    locale: 'en',
    channel: 'email',
    subject: 'Earn revenue from the SOPs you already have',
    body: `Hi {first_name},\n\nI noticed you've been sharing frameworks / playbooks in [community / newsletter / course] — the kind of structured process docs that take real expertise to build.\n\nSophia AI Factory just launched a SOP marketplace where operators can publish and sell those exact documents. Beta creators get:\n- First-mover visibility on the platform\n- 70% revenue share per sale\n- No listing fees during beta\n\nYou'd list your SOP, set your price, and Sophia handles discovery, checkout, and delivery. Your affiliate link also earns commission on any tier upgrades buyers make after downloading: {{REF_LINK}}\n\nIf you have even one battle-tested playbook sitting in a Notion doc, it's worth 15 minutes to list it. Happy to walk you through the process.\n\n— {sender_name}`,
    minTier: 'PREMIUM',
  },
];
