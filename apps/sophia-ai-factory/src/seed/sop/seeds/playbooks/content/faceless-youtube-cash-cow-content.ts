/**
 * Faceless YouTube Cash Cow — Playbook Markdown Content
 * @module seed/sop/seeds/playbooks/content/faceless-youtube-cash-cow-content
 */

export const FACELESS_YOUTUBE_PLAYBOOK_MD = `# Faceless YouTube Cash Cow Playbook

## Step 1: analytics:report
\`\`\`yaml
task: niche_research
niche: "{{config.niche}}"
language: "{{config.language}}"
metrics:
  - search_volume
  - cpm_estimate
  - competition_level
top_results: 10
\`\`\`

## Step 2: ai:generate
\`\`\`yaml
task: video_script
topic: "{{step_1.output.top_topic}}"
niche: "{{config.niche}}"
language: "{{config.language}}"
duration_seconds: {{config.duration_seconds}}
structure:
  - hook_15s
  - value_body
  - cta_30s
seo_title: true
seo_description: true
seo_tags: true
\`\`\`

## Step 3: tts:generate
\`\`\`yaml
text: "{{step_2.output.script}}"
language: "{{config.language}}"
voice_style: professional
output_format: mp3
\`\`\`

## Step 4: video:create
\`\`\`yaml
script: "{{step_2.output.script}}"
style: ai_visuals_broll
language: "{{config.language}}"
duration_seconds: {{config.duration_seconds}}
format: landscape_16x9
\`\`\`

## Step 5: video:compose
\`\`\`yaml
video_id: "{{step_4.output.videoId}}"
voiceover_id: "{{step_3.output.audioId}}"
add_captions: true
caption_language: "{{config.language}}"
output_format: mp4
\`\`\`

## Step 6: image:generate
\`\`\`yaml
task: youtube_thumbnail
title: "{{step_2.output.seo_title}}"
niche: "{{config.niche}}"
style: clickbait_high_ctr
add_text_overlay: true
dimensions: "1280x720"
\`\`\`

## Step 7: publish:youtube
\`\`\`yaml
video_id: "{{step_5.output.videoId}}"
thumbnail_id: "{{step_6.output.imageId}}"
title: "{{step_2.output.seo_title}}"
description: "{{step_2.output.seo_description}}"
tags: "{{step_2.output.seo_tags}}"
category: "{{config.niche}}"
visibility: public
monetization: true
\`\`\`

## Step 8: analytics:track
\`\`\`yaml
youtube_url: "{{step_7.output.youtube_url}}"
metrics:
  - views
  - ctr
  - watch_time
  - estimated_revenue
check_after_hours: 24
\`\`\``;
