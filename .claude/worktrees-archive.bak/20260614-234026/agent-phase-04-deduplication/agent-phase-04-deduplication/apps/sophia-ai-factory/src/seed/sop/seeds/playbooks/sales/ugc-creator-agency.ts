/**
 * Seed: UGC Creator Agency
 * Full end-to-end playbook for running a UGC video agency with AI-powered production.
 * Category: sales | Featured: yes
 */

import type { SopSeedEntry } from '../../index';

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
  agentsYaml: `agents:
  business_strategist:
    role: Business Strategist
    goal: Define service packages and client intake workflow for the UGC agency
    tools:
      - ai:generate
    backstory: Agency business consultant specialising in UGC creator monetization and service productization

  outreach_specialist:
    role: Outreach Specialist
    goal: Run DM and email outreach campaigns to attract brand clients
    tools:
      - email:campaign
      - ai:generate
    backstory: B2B outreach expert with a track record of landing brand deals for UGC creators

  production_manager:
    role: Production Manager
    goal: Manage video production pipeline from brief to final delivery
    tools:
      - ai:generate
      - video:create
      - video:compose
    backstory: UGC video production manager coordinating AI-powered creation and client revision workflows`,
  playbookMd: `# UGC Creator Agency Playbook

## Step 1: ai:generate
\`\`\`yaml
task: service_packages
agency_name: "{{config.agency_name}}"
packages:
  - name: Basic
    price_usd: 150
    deliverables: "1 UGC video, 1 revision"
  - name: Pro
    price_usd: 300
    deliverables: "3 UGC videos, 2 revisions, raw footage"
  - name: Premium
    price_usd: 500
    deliverables: "5 UGC videos, unlimited revisions, raw footage, usage rights"
output_format: pdf_proposal
\`\`\`

## Step 2: video:create
\`\`\`yaml
task: portfolio_demo_reel
style: ugc_authentic
avatars: ai_diverse
duration_seconds: 60
format: landscape_16x9
niche: "{{config.niche}}"
\`\`\`

## Step 3: ai:generate
\`\`\`yaml
task: client_intake_form
fields:
  - brand_name
  - product_description
  - target_audience
  - key_messages
  - preferred_tone
  - reference_videos
  - deadline
output_format: google_form_template
\`\`\`

## Step 4: email:campaign
\`\`\`yaml
campaign_type: ugc_brand_outreach
target: "{{config.target_industry}}"
channel:
  - email
  - instagram_dm
  - linkedin_dm
demo_reel_url: "{{step_2.output.video_url}}"
packages_pdf_url: "{{step_1.output.pdf_url}}"
volume: 50
personalization: brand_name
\`\`\`

## Step 5: ai:generate
\`\`\`yaml
task: client_onboarding_checklist
deliverables:
  - signed_agreement
  - completed_intake_form
  - payment_deposit_50pct
  - reference_materials
output_format: checklist_doc
\`\`\`

## Step 6: ai:generate
\`\`\`yaml
task: video_script_from_brief
brief: "{{config.client_brief}}"
brand: "{{config.brand_name}}"
tone: "{{config.video_tone}}"
duration_seconds: 30
ugc_style: true
\`\`\`

## Step 7: video:create
\`\`\`yaml
script: "{{step_6.output.script}}"
style: ugc_authentic
avatar_id: "{{config.avatar_id}}"
format: vertical_9x16
duration_seconds: 30
\`\`\`

## Step 8: ai:generate
\`\`\`yaml
task: client_revision_notes
video_url: "{{step_7.output.video_url}}"
brand: "{{config.brand_name}}"
brief: "{{config.client_brief}}"
format: revision_sheet
\`\`\`

## Step 9: video:compose
\`\`\`yaml
video_id: "{{step_7.output.videoId}}"
add_brand_logo: true
logo_url: "{{config.brand_logo_url}}"
color_grade: warm
output_format: mp4
final_delivery: true
\`\`\`

## Step 10: ai:generate
\`\`\`yaml
task: invoice_and_payment_reminder
client_name: "{{config.brand_name}}"
amount_usd: "{{config.package_price}}"
payment_due_days: 7
include_upsell: true
upsell_offer: "Monthly retainer — 10 videos/mo at 20% discount"
output_format: invoice_pdf
\`\`\``,
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
