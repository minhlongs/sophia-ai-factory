/**
 * Seed: Weekly Newsletter
 * Auto-curated newsletter from RSS + analytics, sent weekly.
 * Category: email | Featured: yes
 */

import type { SopSeedEntry } from '../../index';
import { WEEKLY_NEWSLETTER_PLAYBOOK_MD } from './weekly-newsletter-playbook';

export { WEEKLY_NEWSLETTER_PLAYBOOK_MD };

export const slug = 'weekly-newsletter';

export const template: SopSeedEntry = {
  slug,
  nameVi: 'Bản Tin Email Hàng Tuần',
  nameEn: 'Weekly Newsletter',
  descVi: 'Tự động tổng hợp nội dung từ RSS và analytics để gửi bản tin email hàng tuần',
  descEn: 'Auto-curate content from RSS feeds and analytics to send weekly email newsletter',
  category: 'email',
  creditsPerRun: 3,
  setupTimeMinutes: 8,
  isFeatured: 1,
  agentsYaml: `agents:
  content_curator:
    role: Content Curator
    goal: Curate 5 top articles relevant to {{config.niche}} this week
    tools:
      - analytics:report
    backstory: Content curation specialist with editorial judgment

  newsletter_writer:
    role: Newsletter Writer
    goal: Write engaging newsletter with curated content and brand commentary
    tools:
      - ai:write
    backstory: Newsletter copywriter with high open-rate track record

  newsletter_sender:
    role: Newsletter Sender
    goal: Send newsletter to all active subscribers
    tools:
      - email:campaign
    backstory: Email delivery and scheduling specialist`,
  playbookMd: WEEKLY_NEWSLETTER_PLAYBOOK_MD,
  outputSchema: JSON.stringify({
    type: 'object',
    required: ['campaignId', 'recipientCount'],
    properties: {
      campaignId: { type: 'string' },
      recipientCount: { type: 'integer' },
      subject: { type: 'string' },
    },
  }),
  configSchema: JSON.stringify({
    properties: {
      brand_name: {
        type: 'string',
        title: 'Newsletter / Brand name',
        placeholder: 'e.g. The Sophia Weekly',
      },
      sender_name: {
        type: 'string',
        title: 'Sender name',
        placeholder: 'e.g. Nguyen Van A from Sophia',
      },
      niche: {
        type: 'string',
        title: 'Newsletter topic / niche',
        placeholder: 'e.g. AI marketing, digital agency growth',
      },
      rss_feeds: {
        type: 'string',
        title: 'RSS feed URLs (comma-separated)',
        placeholder: 'https://blog1.com/rss, https://blog2.com/feed',
      },
      editor_intro: {
        type: 'string',
        title: 'Editor intro paragraph',
        placeholder: 'Brief weekly message from you to your readers',
        default: '',
      },
      cta_text: {
        type: 'string',
        title: 'Call-to-action text',
        placeholder: 'e.g. Book a free strategy session',
        default: '',
      },
      tone: {
        type: 'string',
        title: 'Writing tone',
        enum: ['professional', 'conversational', 'educational', 'witty'],
        default: 'conversational',
      },
    },
    required: ['brand_name', 'sender_name', 'niche'],
  }),
  configDefaults: JSON.stringify({
    editor_intro: '',
    cta_text: '',
    tone: 'conversational',
  }),
};
