export const PLAYBOOK_MD = `# AI Avatar Video Agency Playbook

## Step 1: ai:generate
\`\`\`yaml
task: service_tiers
agency_name: "{{config.agency_name}}"
tiers:
  - name: Starter
    price_usd: 500
    deliverables: "2 AI avatar videos/mo, 1 revision each, HD delivery"
  - name: Growth
    price_usd: 1500
    deliverables: "8 AI avatar videos/mo, unlimited revisions, raw files, priority support"
  - name: Enterprise
    price_usd: 3000
    deliverables: "20 AI avatar videos/mo, custom avatar, dedicated manager, white-label"
output_format: pricing_deck
\`\`\`

## Step 2: video:create
\`\`\`yaml
task: agency_demo_reel
style: ai_avatar_showcase
avatars: 3
scenarios:
  - corporate_explainer
  - product_demo
  - testimonial_style
duration_seconds: 90
format: landscape_16x9
brand_overlay: "{{config.agency_name}}"
\`\`\`

## Step 3: ai:generate
\`\`\`yaml
task: landing_page_copy
agency_name: "{{config.agency_name}}"
value_proposition: "Professional AI avatar videos in 24 hours"
sections:
  - hero_headline
  - benefits_list
  - social_proof_placeholders
  - pricing_table
  - faq
  - cta_section
tone: professional_modern
\`\`\`

## Step 4: email:campaign
\`\`\`yaml
campaign_type: ai_video_agency_outreach
channels:
  - linkedin_dm
  - cold_email
target: "{{config.target_market}}"
demo_reel_url: "{{step_2.output.video_url}}"
pricing_deck_url: "{{step_1.output.pdf_url}}"
volume: 100
personalization: company_name
follow_up_days: [3, 7]
\`\`\`

## Step 5: ai:generate
\`\`\`yaml
task: client_onboarding_workflow
steps:
  - signed_contract
  - brand_asset_upload
  - avatar_selection
  - brief_submission
  - deposit_payment_50pct
output_format: onboarding_doc
\`\`\`

## Step 6: ai:generate
\`\`\`yaml
task: video_script_from_brief
brief: "{{config.client_brief}}"
brand_name: "{{config.brand_name}}"
avatar_style: "{{config.avatar_style}}"
tone: "{{config.video_tone}}"
duration_seconds: 60
include_cta: true
\`\`\`

## Step 7: video:create
\`\`\`yaml
script: "{{step_6.output.script}}"
avatar_id: "{{config.avatar_id}}"
language: "{{config.language}}"
duration_seconds: 60
format: "{{config.output_format}}"
\`\`\`

## Step 8: video:compose
\`\`\`yaml
video_id: "{{step_7.output.videoId}}"
add_brand_overlay: true
brand_logo_url: "{{config.brand_logo_url}}"
add_end_card: true
end_card_cta: "{{config.cta_text}}"
color_grade: professional
output_format: mp4
\`\`\`

## Step 9: ai:generate
\`\`\`yaml
task: client_approval_package
video_url: "{{step_8.output.video_url}}"
brand_name: "{{config.brand_name}}"
brief_summary: "{{config.client_brief}}"
revision_instructions: true
approval_deadline_days: 3
output_format: client_email
\`\`\`

## Step 10: ai:generate
\`\`\`yaml
task: monthly_retainer_invoice_and_upsell
client_name: "{{config.brand_name}}"
current_tier: "{{config.service_tier}}"
amount_usd: "{{config.tier_price}}"
payment_due_days: 7
upsell_next_tier: true
upsell_savings_pct: 15
output_format: invoice_with_upsell_pdf
\`\`\``;
