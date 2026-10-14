import type { SopSeedEntry } from '../../../index';
import { AGENTS_YAML } from './agents-yaml';
import { PLAYBOOK_MD } from './playbook-md';
import { CONFIG_DEFAULTS, CONFIG_SCHEMA, OUTPUT_SCHEMA } from './schemas';

export const slug = 'ai-avatar-video-agency';

export const template: SopSeedEntry = {
  slug,
  nameVi: 'Agency Video AI Avatar',
  nameEn: 'AI Avatar Video Agency',
  descVi:
    'Vận hành agency video AI avatar chuyên nghiệp: 3 gói dịch vụ, demo reel, outreach LinkedIn, sản xuất video từ brief khách hàng và upsell retainer hàng tháng',
  descEn:
    'Run a professional AI avatar video agency: 3 service tiers, demo reel, LinkedIn outreach, produce videos from client briefs, and upsell monthly retainers',
  category: 'sales',
  creditsPerRun: 20,
  setupTimeMinutes: 60,
  agentsYaml: AGENTS_YAML,
  playbookMd: PLAYBOOK_MD,
  outputSchema: OUTPUT_SCHEMA,
  configSchema: CONFIG_SCHEMA,
  configDefaults: CONFIG_DEFAULTS,
};

export * from './agents-yaml';
export * from './playbook-md';
export * from './schemas';
