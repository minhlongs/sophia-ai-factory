/**
 * Seed: UGC Creator Agency
 * Full end-to-end playbook for running a UGC video agency with AI-powered production.
 * Category: sales | Featured: yes
 */

import type { SopSeedEntry } from '../../index';
import { ugcCreatorAgencyAgentsYaml } from './ugc-agency-agents';
import { ugcCreatorAgencyPlaybookMd } from './ugc-agency-playbook';

export const slug = 'ugc-creator-agency';

export const template: SopSeedEntry = {
  slug,
  nameVi: 'Agency Sáng Tạo UGC',
  nameEn: 'UGC Creator Agency',
  descVi:
    'Vận hành agency UGC đầy đủ với AI: định nghĩa gói dịch vụ, tạo demo reel, outreach thương hiệu, sản xuất video theo brief khách hàng và thu tiền',
  descEn:
    'Run a full UGC video agency with AI: define service packages, create demo reel, outreach to brands, produce videos per client brief, and collect payment',
  category: 'sales',
  creditsPerRun: 20,
  setupTimeMinutes: 60,
  isFeatured: 1,
  agentsYaml: ugcCreatorAgencyAgentsYaml,
  playbookMd: ugcCreatorAgencyPlaybookMd,
  outputSchema: JSON.stringify({
    type: 'object',
    required: ['demo_reel_url', 'invoice_url'],
    properties: {
      demo_reel_url: { type: 'string' },
      final_video_url: { type: 'string' },
      invoice_url: { type: 'string' },
    },
  }),
  configSchema: JSON.stringify({
    properties: {
      agency_name: {
        type: 'string',
        title: 'Agency Name',
        placeholder: 'e.g. CreatorPro Agency',
      },
      niche: {
        type: 'string',
        title: 'Agency Niche',
        enum: ['ecommerce', 'saas', 'beauty', 'fitness', 'food', 'general'],
        default: 'ecommerce',
      },
      target_industry: {
        type: 'string',
        title: 'Target Client Industry',
        placeholder: 'e.g. DTC brands, Shopify stores, SaaS companies',
      },
      brand_name: {
        type: 'string',
        title: 'Client Brand Name',
        placeholder: 'e.g. BrandX',
      },
      client_brief: {
        type: 'string',
        title: 'Client Video Brief',
        placeholder: 'e.g. 30s product demo for skincare line targeting women 25-40',
      },
      video_tone: {
        type: 'string',
        title: 'Video Tone',
        enum: ['authentic', 'energetic', 'educational', 'testimonial'],
        default: 'authentic',
      },
      package_price: {
        type: 'number',
        title: 'Package Price (USD)',
        default: 300,
      },
    },
    required: ['agency_name', 'niche'],
  }),
  configDefaults: JSON.stringify({
    niche: 'ecommerce',
    video_tone: 'authentic',
    package_price: 300,
  }),
};
