-- SOP Official Seed Data v2 — 31 playbooks (auto-generated)
-- DO NOT EDIT MANUALLY — regenerate with: npm run db:gen-sop-seed-v2
-- Generated at: 2026-05-03T05:42:25.547Z
-- Replaces 0058 seeds. Uses INSERT OR REPLACE for idempotency.

INSERT OR REPLACE INTO sop_templates (id, slug, name_vi, name_en, description_vi, description_en, category, agents_yaml, playbook_md, output_schema, config_schema, config_defaults, setup_time_minutes, is_featured, credits_per_run, version, is_official, author_user_id, status, created_at, updated_at) VALUES ('sop_official_daily_tiktok_3x', 'daily-tiktok-3x', 'TikTok 3 Video / Ngày', 'Daily TikTok 3x', 'Tự động đăng 3 video TikTok mỗi ngày với hook template theo ngách của bạn', 'Auto-post 3 TikTok videos daily with niche-specific hook templates', 'content', 'agents:
  hook_writer:
    role: Hook Writer
    goal: Write 3 attention-grabbing TikTok hooks for {{config.niche}}
    tools:
      - ai:write
    backstory: Viral TikTok copywriter specializing in first-3-second hooks

  video_creator:
    role: Video Creator
    goal: Create short-form video for each hook
    tools:
      - video:create
    backstory: Short-form video specialist using AI avatars

  tiktok_publisher:
    role: TikTok Publisher
    goal: Schedule and publish videos to TikTok
    tools:
      - social:publish
    backstory: Social media automation expert', '# Daily TikTok 3x Playbook

## Step 1: ai:write
```yaml
task: generate_hooks
niche: "{{config.niche}}"
count: {{config.daily_count}}
tone: "{{config.tone}}"
format: tiktok_hook
```

## Step 2: video:create
```yaml
script: "{{step_1.output.hooks[0]}}"
avatar_id: default
duration: 30
format: vertical_9x16
```

## Step 3: video:create
```yaml
script: "{{step_1.output.hooks[1]}}"
avatar_id: default
duration: 30
format: vertical_9x16
```

## Step 4: video:create
```yaml
script: "{{step_1.output.hooks[2]}}"
avatar_id: default
duration: 30
format: vertical_9x16
```

## Step 5: social:publish
```yaml
platform: tiktok
video_ids:
  - "{{step_2.output.videoId}}"
  - "{{step_3.output.videoId}}"
  - "{{step_4.output.videoId}}"
caption_template: "{{config.caption_suffix}}"
schedule: spread_evenly
```', '{"type":"object","required":["videoIds","publishedCount"],"properties":{"videoIds":{"type":"array","items":{"type":"string"},"minItems":1},"publishedCount":{"type":"integer"}}}', '{"properties":{"niche":{"type":"string","title":"Niche / Industry","description":"Your content niche (e.g. fitness, finance, SaaS)","placeholder":"e.g. Digital marketing for restaurants"},"daily_count":{"type":"integer","title":"Videos per day","default":3,"minimum":1,"maximum":5},"tone":{"type":"string","title":"Content tone","enum":["professional","casual","witty","educational"],"default":"casual"},"caption_suffix":{"type":"string","title":"Caption suffix / hashtags","placeholder":"#growth #agency","default":""}},"required":["niche"]}', '{"daily_count":3,"tone":"casual","caption_suffix":""}', 5, 1, 6, 1, 1, NULL, 'published', 1777786945, 1777786945);

INSERT OR REPLACE INTO sop_templates (id, slug, name_vi, name_en, description_vi, description_en, category, agents_yaml, playbook_md, output_schema, config_schema, config_defaults, setup_time_minutes, is_featured, credits_per_run, version, is_official, author_user_id, status, created_at, updated_at) VALUES ('sop_official_weekly_youtube_longform', 'weekly-youtube-longform', 'YouTube Dài Hàng Tuần', 'Weekly YouTube Longform', 'Tự động tạo và đăng 1 video YouTube dài (10-15 phút) mỗi tuần', 'Auto-create and publish one 10-15 min YouTube video every week', 'content', 'agents:
  topic_researcher:
    role: Topic Researcher
    goal: Find trending topics in {{config.niche}} for YouTube
    tools:
      - analytics:report
    backstory: YouTube SEO strategist tracking trending searches

  script_writer:
    role: Script Writer
    goal: Write a full 10-minute video script
    tools:
      - ai:write
    backstory: Expert YouTube script writer with hook-body-CTA structure

  video_producer:
    role: Video Producer
    goal: Produce and render long-form video
    tools:
      - video:create
    backstory: Video production specialist for long-form content', '# Weekly YouTube Longform Playbook

## Step 1: analytics:report
```yaml
type: trending_topics
niche: "{{config.niche}}"
platform: youtube
limit: 5
```

## Step 2: ai:write
```yaml
task: youtube_script
topic: "{{step_1.output.topics[0]}}"
duration_minutes: {{config.video_duration}}
target_audience: "{{config.target_audience}}"
style: educational_entertaining
include_cta: true
```

## Step 3: video:create
```yaml
script: "{{step_2.output.script}}"
avatar_id: default
duration: {{config.video_duration}}
format: landscape_16x9
thumbnail_auto: true
```

## Step 4: social:publish
```yaml
platform: youtube
video_id: "{{step_3.output.videoId}}"
title: "{{step_2.output.title}}"
description: "{{step_2.output.description}}"
tags: "{{step_1.output.tags}}"
visibility: public
```', '{"type":"object","required":["videoId","youtubeUrl"],"properties":{"videoId":{"type":"string"},"youtubeUrl":{"type":"string"}}}', '{"properties":{"niche":{"type":"string","title":"Niche / Topic","placeholder":"e.g. Personal finance for millennials"},"target_audience":{"type":"string","title":"Target audience","placeholder":"e.g. Small business owners aged 25-45"},"video_duration":{"type":"integer","title":"Video duration (minutes)","default":12,"minimum":8,"maximum":20}},"required":["niche"]}', '{"video_duration":12}', 8, 0, 15, 1, 1, NULL, 'published', 1777786945, 1777786945);

INSERT OR REPLACE INTO sop_templates (id, slug, name_vi, name_en, description_vi, description_en, category, agents_yaml, playbook_md, output_schema, config_schema, config_defaults, setup_time_minutes, is_featured, credits_per_run, version, is_official, author_user_id, status, created_at, updated_at) VALUES ('sop_official_daily_instagram_reels', 'daily-instagram-reels', 'Instagram Reels 3 Video / Ngày', 'Daily Instagram Reels 3x', 'Đăng 3 Instagram Reels mỗi ngày với âm thanh trending và caption phù hợp', 'Post 3 Instagram Reels daily with trending audio and optimized captions', 'content', 'agents:
  content_planner:
    role: Content Planner
    goal: Plan 3 Reels topics for {{config.brand_name}} in {{config.niche}}
    tools:
      - ai:write
    backstory: Instagram growth strategist

  video_creator:
    role: Video Creator
    goal: Create vertical Reels videos
    tools:
      - video:create
    backstory: Short-form video expert

  ig_publisher:
    role: Instagram Publisher
    goal: Publish Reels to Instagram account
    tools:
      - social:publish
    backstory: Social media automation specialist', '# Daily Instagram Reels Playbook

## Step 1: ai:write
```yaml
task: reels_content_plan
brand: "{{config.brand_name}}"
niche: "{{config.niche}}"
count: 3
tone: "{{config.tone}}"
include_hashtags: true
```

## Step 2: video:create
```yaml
script: "{{step_1.output.scripts[0]}}"
format: vertical_9x16
duration: 30
```

## Step 3: video:create
```yaml
script: "{{step_1.output.scripts[1]}}"
format: vertical_9x16
duration: 30
```

## Step 4: video:create
```yaml
script: "{{step_1.output.scripts[2]}}"
format: vertical_9x16
duration: 30
```

## Step 5: social:publish
```yaml
platform: instagram
type: reels
video_ids:
  - "{{step_2.output.videoId}}"
  - "{{step_3.output.videoId}}"
  - "{{step_4.output.videoId}}"
captions: "{{step_1.output.captions}}"
hashtags: "{{step_1.output.hashtags}}"
schedule: spread_evenly
```', '{"type":"object","required":["publishedCount"],"properties":{"publishedCount":{"type":"integer"},"postUrls":{"type":"array","items":{"type":"string"}}}}', '{"properties":{"brand_name":{"type":"string","title":"Brand / Account Name","placeholder":"e.g. Sophia Agency"},"niche":{"type":"string","title":"Niche","placeholder":"e.g. business coaching, beauty, food"},"tone":{"type":"string","title":"Content tone","enum":["professional","casual","inspirational","humorous"],"default":"casual"}},"required":["brand_name","niche"]}', '{"tone":"casual"}', 5, 0, 6, 1, 1, NULL, 'published', 1777786945, 1777786945);

INSERT OR REPLACE INTO sop_templates (id, slug, name_vi, name_en, description_vi, description_en, category, agents_yaml, playbook_md, output_schema, config_schema, config_defaults, setup_time_minutes, is_featured, credits_per_run, version, is_official, author_user_id, status, created_at, updated_at) VALUES ('sop_official_multi_channel_crosspost', 'multi-channel-crosspost', 'Đăng Chéo Đa Kênh', 'Multi-Channel Crosspost', '1 video → tự động đăng lên TikTok, Instagram Reels, YouTube Shorts và Twitter/X', '1 video → auto-repurpose and post to TikTok, IG Reels, YouTube Shorts, Twitter/X', 'content', 'agents:
  content_adapter:
    role: Content Adapter
    goal: Adapt captions and hashtags for each platform
    tools:
      - ai:write
    backstory: Multi-platform content strategist

  crosspost_publisher:
    role: Crosspost Publisher
    goal: Publish adapted content to all selected platforms
    tools:
      - social:publish
    backstory: Social media distribution specialist', '# Multi-Channel Crosspost Playbook

## Step 1: ai:write
```yaml
task: adapt_captions
original_caption: "{{config.original_caption}}"
platforms:
  - tiktok
  - instagram
  - youtube
  - twitter
brand_voice: "{{config.tone}}"
include_hashtags: true
```

## Step 2: social:publish
```yaml
platform: tiktok
video_url: "{{config.video_url}}"
caption: "{{step_1.output.captions.tiktok}}"
hashtags: "{{step_1.output.hashtags.tiktok}}"
```

## Step 3: social:publish
```yaml
platform: instagram
type: reels
video_url: "{{config.video_url}}"
caption: "{{step_1.output.captions.instagram}}"
hashtags: "{{step_1.output.hashtags.instagram}}"
```

## Step 4: social:publish
```yaml
platform: youtube
type: shorts
video_url: "{{config.video_url}}"
title: "{{step_1.output.captions.youtube}}"
```

## Step 5: social:publish
```yaml
platform: twitter
video_url: "{{config.video_url}}"
tweet: "{{step_1.output.captions.twitter}}"
```', '{"type":"object","required":["publishedPlatforms"],"properties":{"publishedPlatforms":{"type":"array","items":{"type":"string"}}}}', '{"properties":{"video_url":{"type":"string","title":"Source video URL","placeholder":"https://..."},"original_caption":{"type":"string","title":"Original caption / topic","placeholder":"Brief description of what the video is about"},"tone":{"type":"string","title":"Brand tone","enum":["professional","casual","witty","educational"],"default":"casual"}},"required":["video_url","original_caption"]}', '{"tone":"casual"}', 7, 0, 8, 1, 1, NULL, 'published', 1777786945, 1777786945);

INSERT OR REPLACE INTO sop_templates (id, slug, name_vi, name_en, description_vi, description_en, category, agents_yaml, playbook_md, output_schema, config_schema, config_defaults, setup_time_minutes, is_featured, credits_per_run, version, is_official, author_user_id, status, created_at, updated_at) VALUES ('sop_official_auto_subtitle_translate', 'auto-subtitle-translate', 'Tự Động Phụ Đề & Dịch Thuật', 'Auto Subtitle & Translate', 'Tự động tạo phụ đề và dịch video giữa tiếng Anh và tiếng Việt', 'Auto-generate subtitles and translate video between English and Vietnamese', 'content', 'agents:
  transcriber:
    role: Transcriber
    goal: Transcribe speech from video to text
    tools:
      - ai:transcribe
    backstory: Speech-to-text specialist with high accuracy

  translator:
    role: Translator
    goal: Translate transcript to target language
    tools:
      - ai:translate
    backstory: Professional translator for EN-VI

  subtitle_renderer:
    role: Subtitle Renderer
    goal: Burn subtitles into video and export
    tools:
      - video:subtitle
    backstory: Video post-production specialist', '# Auto Subtitle & Translate Playbook

## Step 1: ai:transcribe
```yaml
video_url: "{{config.video_url}}"
source_language: "{{config.source_language}}"
```

## Step 2: ai:translate
```yaml
text: "{{step_1.output.transcript}}"
source_lang: "{{config.source_language}}"
target_lang: "{{config.target_language}}"
```

## Step 3: video:subtitle
```yaml
video_url: "{{config.video_url}}"
subtitles:
  original: "{{step_1.output.srt}}"
  translated: "{{step_2.output.srt}}"
style: "{{config.subtitle_style}}"
burn_in: true
```', '{"type":"object","required":["outputVideoUrl","transcript"],"properties":{"outputVideoUrl":{"type":"string"},"transcript":{"type":"string"},"translatedText":{"type":"string"}}}', '{"properties":{"video_url":{"type":"string","title":"Video URL to process","placeholder":"https://..."},"source_language":{"type":"string","title":"Original language","enum":["en","vi"],"default":"en"},"target_language":{"type":"string","title":"Translation language","enum":["vi","en"],"default":"vi"},"subtitle_style":{"type":"string","title":"Subtitle style","enum":["standard","bold","highlight"],"default":"standard"}},"required":["video_url"]}', '{"source_language":"en","target_language":"vi","subtitle_style":"standard"}', 3, 0, 4, 1, 1, NULL, 'published', 1777786945, 1777786945);

INSERT OR REPLACE INTO sop_templates (id, slug, name_vi, name_en, description_vi, description_en, category, agents_yaml, playbook_md, output_schema, config_schema, config_defaults, setup_time_minutes, is_featured, credits_per_run, version, is_official, author_user_id, status, created_at, updated_at) VALUES ('sop_official_voice_clone_narration', 'voice-clone-narration', 'Nhân Bản Giọng Nói AI (BETA)', 'Voice Clone Narration (BETA)', 'Nhân bản giọng nói và tạo narration AI cho video sản phẩm — tính năng thử nghiệm', 'Clone your voice and generate AI narration for product videos — BETA feature', 'content', 'agents:
  script_writer:
    role: Script Writer
    goal: Write narration script for {{config.product_name}}
    tools:
      - ai:write
    backstory: Product video copywriter

  voice_narrator:
    role: Voice Narrator
    goal: Generate narration using cloned voice profile
    tools:
      - voice:clone_narrate
    backstory: ElevenLabs voice synthesis specialist (BETA)

  video_merger:
    role: Video Merger
    goal: Merge narration audio with product video
    tools:
      - video:merge_audio
    backstory: Video post-production engineer', '# Voice Clone Narration Playbook (BETA)

## Step 1: ai:write
```yaml
task: product_narration_script
product_name: "{{config.product_name}}"
key_benefits: "{{config.key_benefits}}"
duration_seconds: {{config.duration_seconds}}
tone: "{{config.tone}}"
```

## Step 2: voice:clone_narrate
```yaml
text: "{{step_1.output.script}}"
voice_profile_id: "{{config.voice_profile_id}}"
speed: 1.0
```

## Step 3: video:merge_audio
```yaml
video_url: "{{config.video_url}}"
audio_url: "{{step_2.output.audioUrl}}"
replace_original_audio: true
```', '{"type":"object","required":["outputVideoUrl"],"properties":{"outputVideoUrl":{"type":"string"},"audioUrl":{"type":"string"},"script":{"type":"string"}}}', '{"properties":{"product_name":{"type":"string","title":"Product name","placeholder":"e.g. Sophia AI Pro Plan"},"key_benefits":{"type":"string","title":"Key benefits (comma-separated)","placeholder":"e.g. saves 10 hours/week, automates social media"},"video_url":{"type":"string","title":"Source video URL","placeholder":"https://..."},"voice_profile_id":{"type":"string","title":"Voice profile ID (from ElevenLabs)","placeholder":"elevenlabs_voice_xxxxx"},"duration_seconds":{"type":"integer","title":"Target duration (seconds)","default":60,"minimum":15,"maximum":180},"tone":{"type":"string","title":"Narration tone","enum":["professional","conversational","enthusiastic"],"default":"professional"}},"required":["product_name","key_benefits"]}', '{"duration_seconds":60,"tone":"professional"}', 10, 0, 10, 1, 1, NULL, 'published', 1777786945, 1777786945);

INSERT OR REPLACE INTO sop_templates (id, slug, name_vi, name_en, description_vi, description_en, category, agents_yaml, playbook_md, output_schema, config_schema, config_defaults, setup_time_minutes, is_featured, credits_per_run, version, is_official, author_user_id, status, created_at, updated_at) VALUES ('sop_official_branded_intro_outro', 'branded-intro-outro', 'Gắn Intro/Outro Thương Hiệu', 'Branded Intro & Outro', 'Tự động thêm intro và outro thương hiệu vào mỗi video trước khi đăng', 'Auto-add branded intro and outro overlay to every video before publishing', 'content', 'agents:
  video_editor:
    role: Video Editor
    goal: Merge intro, main video, and outro into final cut
    tools:
      - video:edit
    backstory: Professional video editor specializing in brand consistency

  quality_checker:
    role: Quality Checker
    goal: Verify final video meets quality standards
    tools:
      - video:analyze
    backstory: Video QA specialist', '# Branded Intro/Outro Playbook

## Step 1: video:edit
```yaml
operation: merge_clips
clips:
  - url: "{{config.intro_url}}"
    position: start
  - url: "{{config.main_video_url}}"
    position: middle
  - url: "{{config.outro_url}}"
    position: end
output_format: mp4
add_watermark: "{{config.watermark_text}}"
```

## Step 2: video:analyze
```yaml
video_url: "{{step_1.output.outputUrl}}"
checks:
  - audio_levels
  - resolution
  - duration
```', '{"type":"object","required":["outputVideoUrl","duration"],"properties":{"outputVideoUrl":{"type":"string"},"duration":{"type":"number"}}}', '{"properties":{"main_video_url":{"type":"string","title":"Main video URL","placeholder":"https://..."},"intro_url":{"type":"string","title":"Branded intro video URL","placeholder":"https://... (5-10 second clip)"},"outro_url":{"type":"string","title":"Branded outro video URL","placeholder":"https://... (5-10 second clip)"},"watermark_text":{"type":"string","title":"Watermark text (optional)","placeholder":"e.g. @YourBrand","default":""}},"required":["main_video_url"]}', '{"watermark_text":""}', 7, 0, 3, 1, 1, NULL, 'published', 1777786945, 1777786945);

INSERT OR REPLACE INTO sop_templates (id, slug, name_vi, name_en, description_vi, description_en, category, agents_yaml, playbook_md, output_schema, config_schema, config_defaults, setup_time_minutes, is_featured, credits_per_run, version, is_official, author_user_id, status, created_at, updated_at) VALUES ('sop_official_evergreen_content_recycle', 'evergreen-content-recycle', 'Tái Chế Nội Dung Evergreen', 'Evergreen Content Recycle', 'Hàng tháng tự động tái đăng nội dung hoạt động tốt nhất với caption mới', 'Monthly auto-repost of top-performing content with fresh captions', 'content', 'agents:
  performance_analyzer:
    role: Performance Analyzer
    goal: Find top 3 performing posts from last 30 days
    tools:
      - analytics:report
    backstory: Social media analytics expert

  caption_refresher:
    role: Caption Refresher
    goal: Rewrite captions with fresh angles for recycled content
    tools:
      - ai:write
    backstory: Creative copywriter specializing in content repurposing

  reposter:
    role: Reposter
    goal: Republish selected content with new captions
    tools:
      - social:publish
    backstory: Social media scheduler', '# Evergreen Content Recycle Playbook

## Step 1: analytics:report
```yaml
type: top_performing_posts
platform: "{{config.platform}}"
period: last_30_days
limit: 3
metric: engagement_rate
```

## Step 2: ai:write
```yaml
task: refresh_captions
posts: "{{step_1.output.posts}}"
brand_voice: "{{config.brand_voice}}"
avoid_duplicate_hooks: true
```

## Step 3: social:publish
```yaml
platform: "{{config.platform}}"
posts: "{{step_1.output.posts}}"
captions: "{{step_2.output.captions}}"
schedule: spread_over_month
```', '{"type":"object","required":["recycledCount"],"properties":{"recycledCount":{"type":"integer"},"postIds":{"type":"array","items":{"type":"string"}}}}', '{"properties":{"platform":{"type":"string","title":"Social platform","enum":["tiktok","instagram","youtube","twitter"],"default":"instagram"},"brand_voice":{"type":"string","title":"Brand voice","enum":["professional","casual","inspirational","witty"],"default":"casual"}},"required":[]}', '{"platform":"instagram","brand_voice":"casual"}', 5, 0, 4, 1, 1, NULL, 'published', 1777786945, 1777786945);

INSERT OR REPLACE INTO sop_templates (id, slug, name_vi, name_en, description_vi, description_en, category, agents_yaml, playbook_md, output_schema, config_schema, config_defaults, setup_time_minutes, is_featured, credits_per_run, version, is_official, author_user_id, status, created_at, updated_at) VALUES ('sop_official_daily_lead_enrichment', 'daily-lead-enrichment', 'Làm Giàu Lead Hàng Ngày', 'Daily Lead Enrichment', 'Tự động làm giàu 50 lead mỗi ngày phù hợp với hồ sơ khách hàng lý tưởng (ICP)', 'Auto-enrich 50 leads per day matching your Ideal Customer Profile (ICP)', 'leads', 'agents:
  lead_finder:
    role: Lead Finder
    goal: Find {{config.leads_per_day}} new leads matching ICP in {{config.target_industry}}
    tools:
      - lead:find
    backstory: B2B prospecting specialist

  lead_enricher:
    role: Lead Enricher
    goal: Enrich each lead with company data, contact info, and intent signals
    tools:
      - lead:enrich
    backstory: Data enrichment expert using Apollo, Clearbit, and LinkedIn

  lead_scorer:
    role: Lead Scorer
    goal: Score and tag leads by fit and intent
    tools:
      - lead:score
    backstory: Revenue operations analyst', '# Daily Lead Enrichment Playbook

## Step 1: lead:find
```yaml
industry: "{{config.target_industry}}"
company_size: "{{config.company_size}}"
location: "{{config.location}}"
title_keywords: "{{config.decision_maker_title}}"
limit: {{config.leads_per_day}}
exclude_existing: true
```

## Step 2: lead:enrich
```yaml
leads: "{{step_1.output.leads}}"
fields:
  - company_revenue
  - employee_count
  - linkedin_url
  - email
  - phone
  - tech_stack
```

## Step 3: lead:score
```yaml
enriched_leads: "{{step_2.output.enriched}}"
icp_criteria:
  industry: "{{config.target_industry}}"
  company_size: "{{config.company_size}}"
  decision_maker_title: "{{config.decision_maker_title}}"
tag_hot_threshold: 80
```', '{"type":"object","required":["enrichedCount","hotLeadsCount"],"properties":{"enrichedCount":{"type":"integer"},"hotLeadsCount":{"type":"integer"},"leads":{"type":"array","items":{"type":"object"}}}}', '{"properties":{"target_industry":{"type":"string","title":"Target industry","placeholder":"e.g. SaaS, E-commerce, Real Estate"},"company_size":{"type":"string","title":"Company size","enum":["1-10","11-50","51-200","201-1000","1000+","any"],"default":"11-50"},"location":{"type":"string","title":"Location / Market","placeholder":"e.g. Vietnam, Southeast Asia, United States","default":"Vietnam"},"decision_maker_title":{"type":"string","title":"Decision-maker title keywords","placeholder":"e.g. CEO, Marketing Director, Founder","default":"CEO, Founder"},"leads_per_day":{"type":"integer","title":"Leads to find per run","default":50,"minimum":10,"maximum":200}},"required":["target_industry"]}', '{"company_size":"11-50","location":"Vietnam","decision_maker_title":"CEO, Founder","leads_per_day":50}', 5, 1, 8, 1, 1, NULL, 'published', 1777786945, 1777786945);

INSERT OR REPLACE INTO sop_templates (id, slug, name_vi, name_en, description_vi, description_en, category, agents_yaml, playbook_md, output_schema, config_schema, config_defaults, setup_time_minutes, is_featured, credits_per_run, version, is_official, author_user_id, status, created_at, updated_at) VALUES ('sop_official_reactive_form_lead', 'reactive-form-lead', 'Tự Động Phản Hồi Lead Từ Form', 'Reactive Form Lead Engine', 'Khi khách điền form → làm giàu dữ liệu → gửi email cá nhân hóa ngay lập tức', 'When visitor fills form → enrich lead data → send personalized email instantly', 'leads', 'agents:
  lead_enricher:
    role: Lead Enricher
    goal: Enrich incoming lead with company and contact data
    tools:
      - lead:enrich
    backstory: Real-time lead enrichment specialist

  personalization_writer:
    role: Personalization Writer
    goal: Write a personalized first-touch email for the lead
    tools:
      - ai:write
    backstory: Conversion copywriter specializing in cold email

  email_sender:
    role: Email Sender
    goal: Send personalized email within 5 minutes of form submission
    tools:
      - email:test
    backstory: Email deliverability expert', '# Reactive Form Lead Playbook

Triggered via webhook when a lead submits your contact form.

## Step 1: lead:enrich
```yaml
email: "{{trigger.body.email}}"
name: "{{trigger.body.name}}"
company: "{{trigger.body.company}}"
fields:
  - linkedin_url
  - company_size
  - industry
  - tech_stack
```

## Step 2: ai:write
```yaml
task: personalized_first_touch
lead_name: "{{step_1.output.name}}"
company: "{{step_1.output.company}}"
industry: "{{step_1.output.industry}}"
sender_name: "{{config.sender_name}}"
service_offered: "{{config.service_description}}"
tone: "{{config.email_tone}}"
```

## Step 3: email:test
```yaml
to: "{{step_1.output.email}}"
from_name: "{{config.sender_name}}"
subject: "{{step_2.output.subject}}"
body: "{{step_2.output.body}}"
track_opens: true
```', '{"type":"object","required":["leadId","emailId"],"properties":{"leadId":{"type":"string"},"enriched":{"type":"object"},"emailId":{"type":"string"}}}', '{"properties":{"sender_name":{"type":"string","title":"Your name (email sender)","placeholder":"e.g. Nguyen Van A"},"service_description":{"type":"string","title":"What service do you offer?","placeholder":"e.g. AI-powered social media management for restaurants"},"email_tone":{"type":"string","title":"Email tone","enum":["friendly","professional","direct","consultative"],"default":"friendly"}},"required":["sender_name","service_description"]}', '{"email_tone":"friendly"}', 5, 0, 2, 1, 1, NULL, 'published', 1777786945, 1777786945);

INSERT OR REPLACE INTO sop_templates (id, slug, name_vi, name_en, description_vi, description_en, category, agents_yaml, playbook_md, output_schema, config_schema, config_defaults, setup_time_minutes, is_featured, credits_per_run, version, is_official, author_user_id, status, created_at, updated_at) VALUES ('sop_official_linkedin_outreach', 'linkedin-outreach', 'Gửi DM LinkedIn Tự Động (BETA)', 'LinkedIn DM Outreach (BETA)', 'Tự động gửi chuỗi tin nhắn LinkedIn đến danh sách khách tiềm năng — tính năng thử nghiệm', 'Auto-send LinkedIn DM sequences to prospect lists — BETA feature', 'leads', 'agents:
  message_writer:
    role: Message Writer
    goal: Write personalized LinkedIn DMs for {{config.target_role}} in {{config.target_industry}}
    tools:
      - ai:write
    backstory: LinkedIn outreach copywriter with high acceptance rates

  linkedin_sender:
    role: LinkedIn Sender
    goal: Send DMs via LinkedIn API (BETA)
    tools:
      - linkedin:send_message
    backstory: LinkedIn automation specialist (BETA integration)', '# LinkedIn DM Outreach Playbook (BETA)

> **BETA**: Requires LinkedIn API access. Contact support to enable.

## Step 1: ai:write
```yaml
task: linkedin_dm_sequence
target_role: "{{config.target_role}}"
target_industry: "{{config.target_industry}}"
your_value_prop: "{{config.value_proposition}}"
sequence_steps: 3
tone: conversational
avoid_salesy: true
```

## Step 2: linkedin:send_message
```yaml
recipient_profile_url: "{{trigger.body.linkedin_url}}"
message: "{{step_1.output.message_1}}"
connection_note: true
```', '{"type":"object","required":["sentCount"],"properties":{"sentCount":{"type":"integer"},"messageIds":{"type":"array","items":{"type":"string"}}}}', '{"properties":{"target_role":{"type":"string","title":"Target job title","placeholder":"e.g. Marketing Manager, CEO, Founder"},"target_industry":{"type":"string","title":"Target industry","placeholder":"e.g. Real Estate, E-commerce, Healthcare"},"value_proposition":{"type":"string","title":"Your value proposition","placeholder":"e.g. We help restaurants get 50+ new customers/month with AI marketing"}},"required":["target_role","value_proposition"]}', '{}', 10, 0, 5, 1, 1, NULL, 'published', 1777786945, 1777786945);

INSERT OR REPLACE INTO sop_templates (id, slug, name_vi, name_en, description_vi, description_en, category, agents_yaml, playbook_md, output_schema, config_schema, config_defaults, setup_time_minutes, is_featured, credits_per_run, version, is_official, author_user_id, status, created_at, updated_at) VALUES ('sop_official_cold_email_warmup', 'cold-email-warmup', 'Khởi Động Email Lạnh', 'Cold Email Warmup', 'Gửi 5 email mỗi ngày để làm ấm domain và tăng uy tín người gửi trước chiến dịch lớn', 'Send 5 warmup emails/day to build domain reputation before big campaigns', 'leads', 'agents:
  warmup_sender:
    role: Warmup Sender
    goal: Send {{config.daily_volume}} warmup emails to build sender reputation
    tools:
      - email:campaign
    backstory: Email deliverability specialist

  reputation_monitor:
    role: Reputation Monitor
    goal: Monitor open rates and spam scores from warmup emails
    tools:
      - analytics:report
    backstory: Email analytics expert', '# Cold Email Warmup Playbook

## Step 1: email:campaign
```yaml
type: warmup
from_email: "{{config.sender_email}}"
from_name: "{{config.sender_name}}"
daily_volume: {{config.daily_volume}}
content_variation: high
reply_simulation: true
```

## Step 2: analytics:report
```yaml
type: email_warmup_metrics
email_account: "{{config.sender_email}}"
period: today
```', '{"type":"object","required":["sentCount","reputationScore"],"properties":{"sentCount":{"type":"integer"},"reputationScore":{"type":"number"},"openRate":{"type":"number"}}}', '{"properties":{"sender_email":{"type":"string","title":"Your sending email","format":"email","placeholder":"you@yourdomain.com"},"sender_name":{"type":"string","title":"Sender name","placeholder":"e.g. Nguyen Van A"},"daily_volume":{"type":"integer","title":"Warmup emails per day","default":5,"minimum":2,"maximum":20}},"required":["sender_email","sender_name"]}', '{"daily_volume":5}', 5, 0, 2, 1, 1, NULL, 'published', 1777786945, 1777786945);

INSERT OR REPLACE INTO sop_templates (id, slug, name_vi, name_en, description_vi, description_en, category, agents_yaml, playbook_md, output_schema, config_schema, config_defaults, setup_time_minutes, is_featured, credits_per_run, version, is_official, author_user_id, status, created_at, updated_at) VALUES ('sop_official_icp_scoring', 'icp-scoring', 'Chấm Điểm Lead Theo ICP', 'ICP Lead Scoring', 'Tự động chấm điểm và gắn thẻ lead dựa trên tiêu chí hồ sơ khách hàng lý tưởng của bạn', 'Auto-score and tag leads against your Ideal Customer Profile criteria', 'leads', 'agents:
  icp_scorer:
    role: ICP Scorer
    goal: Score all unscored leads against ICP criteria
    tools:
      - lead:score
    backstory: Revenue operations analyst specializing in ICP frameworks

  lead_tagger:
    role: Lead Tagger
    goal: Apply hot/warm/cold tags based on scores
    tools:
      - lead:tag
    backstory: CRM automation specialist', '# ICP Lead Scoring Playbook

## Step 1: lead:score
```yaml
scope: unscored_leads
icp_criteria:
  target_industry: "{{config.target_industry}}"
  company_size_min: {{config.company_size_min}}
  company_size_max: {{config.company_size_max}}
  title_keywords: "{{config.title_keywords}}"
  geography: "{{config.geography}}"
weights:
  industry_match: 40
  title_match: 30
  size_match: 20
  geography_match: 10
```

## Step 2: lead:tag
```yaml
scored_leads: "{{step_1.output.scored}}"
rules:
  - score_gte: 80
    tag: hot_lead
  - score_gte: 50
    tag: warm_lead
  - score_lt: 50
    tag: cold_lead
```', '{"type":"object","required":["scoredCount","hotCount"],"properties":{"scoredCount":{"type":"integer"},"hotCount":{"type":"integer"},"warmCount":{"type":"integer"},"coldCount":{"type":"integer"}}}', '{"properties":{"target_industry":{"type":"string","title":"Target industry","placeholder":"e.g. SaaS, Retail, Healthcare"},"company_size_min":{"type":"integer","title":"Min company size (employees)","default":10,"minimum":1},"company_size_max":{"type":"integer","title":"Max company size (employees)","default":500,"minimum":1},"title_keywords":{"type":"string","title":"Decision-maker title keywords","placeholder":"CEO, Founder, Marketing Director","default":"CEO, Founder"},"geography":{"type":"string","title":"Target geography","placeholder":"e.g. Vietnam, Southeast Asia","default":"Vietnam"}},"required":["target_industry"]}', '{"company_size_min":10,"company_size_max":500,"title_keywords":"CEO, Founder","geography":"Vietnam"}', 8, 0, 3, 1, 1, NULL, 'published', 1777786945, 1777786945);

INSERT OR REPLACE INTO sop_templates (id, slug, name_vi, name_en, description_vi, description_en, category, agents_yaml, playbook_md, output_schema, config_schema, config_defaults, setup_time_minutes, is_featured, credits_per_run, version, is_official, author_user_id, status, created_at, updated_at) VALUES ('sop_official_welcome_drip_7day', 'welcome-drip-7day', 'Chuỗi Email Chào Mừng 7 Ngày', '7-Day Welcome Email Drip', 'Tự động gửi 7 email chào mừng trong 7 ngày đầu sau khi khách đăng ký', 'Auto-send 7 welcome emails over 7 days to new subscribers', 'email', 'agents:
  sequence_writer:
    role: Sequence Writer
    goal: Write 7-day welcome email series for {{config.brand_name}}
    tools:
      - ai:write
    backstory: Email copywriter specializing in onboarding sequences

  drip_sender:
    role: Drip Sender
    goal: Queue and schedule 7 emails for new subscriber
    tools:
      - email:campaign
    backstory: Email automation specialist', '# 7-Day Welcome Drip Playbook

Triggered when a new subscriber joins via webhook.

## Step 1: ai:write
```yaml
task: welcome_drip_sequence
brand_name: "{{config.brand_name}}"
product_description: "{{config.product_description}}"
primary_cta: "{{config.primary_cta}}"
subscriber_name: "{{trigger.body.name}}"
days: 7
tone: "{{config.tone}}"
```

## Step 2: email:campaign
```yaml
type: drip_sequence
to: "{{trigger.body.email}}"
from_name: "{{config.sender_name}}"
sequence: "{{step_1.output.emails}}"
start_immediately: true
interval_days: 1
```', '{"type":"object","required":["sequenceId","scheduledCount"],"properties":{"sequenceId":{"type":"string"},"scheduledCount":{"type":"integer"}}}', '{"properties":{"brand_name":{"type":"string","title":"Brand / Company name","placeholder":"e.g. Sophia Agency"},"sender_name":{"type":"string","title":"Sender name","placeholder":"e.g. The Sophia Team"},"product_description":{"type":"string","title":"Briefly describe your product/service","placeholder":"e.g. AI automation tools for digital agencies"},"primary_cta":{"type":"string","title":"Primary call-to-action","placeholder":"e.g. Book a free strategy call, Start your free trial"},"tone":{"type":"string","title":"Email tone","enum":["friendly","professional","conversational","educational"],"default":"friendly"}},"required":["brand_name","sender_name","product_description"]}', '{"tone":"friendly"}', 10, 0, 5, 1, 1, NULL, 'published', 1777786945, 1777786945);

INSERT OR REPLACE INTO sop_templates (id, slug, name_vi, name_en, description_vi, description_en, category, agents_yaml, playbook_md, output_schema, config_schema, config_defaults, setup_time_minutes, is_featured, credits_per_run, version, is_official, author_user_id, status, created_at, updated_at) VALUES ('sop_official_reengagement_campaign', 'reengagement-campaign', 'Chiến Dịch Tái Kích Hoạt', 'Re-engagement Campaign', 'Tự động gửi 3 email để win-back các subscriber không hoạt động trong 30+ ngày', 'Auto-send 3-email win-back sequence to subscribers inactive for 30+ days', 'email', 'agents:
  inactive_finder:
    role: Inactive Finder
    goal: Find subscribers inactive for {{config.inactive_days}} days
    tools:
      - analytics:report
    backstory: Email list hygiene specialist

  winback_writer:
    role: Winback Writer
    goal: Write compelling win-back email sequence
    tools:
      - ai:write
    backstory: Re-engagement copywriter with high re-activation rates

  campaign_sender:
    role: Campaign Sender
    goal: Send win-back sequence to inactive list
    tools:
      - email:campaign
    backstory: Email marketing automation specialist', '# Re-engagement Campaign Playbook

## Step 1: analytics:report
```yaml
type: inactive_subscribers
inactive_days: {{config.inactive_days}}
limit: {{config.batch_size}}
exclude_unsubscribed: true
```

## Step 2: ai:write
```yaml
task: winback_sequence
brand_name: "{{config.brand_name}}"
inactive_days: {{config.inactive_days}}
offer: "{{config.special_offer}}"
emails_count: 3
urgency: medium
```

## Step 3: email:campaign
```yaml
type: drip_sequence
recipients: "{{step_1.output.subscribers}}"
from_name: "{{config.sender_name}}"
sequence: "{{step_2.output.emails}}"
interval_days: 3
add_unsubscribe_link: true
```', '{"type":"object","required":["targetedCount","sequenceId"],"properties":{"targetedCount":{"type":"integer"},"sequenceId":{"type":"string"}}}', '{"properties":{"brand_name":{"type":"string","title":"Brand name","placeholder":"e.g. Sophia Agency"},"sender_name":{"type":"string","title":"Sender name","placeholder":"e.g. The Sophia Team"},"inactive_days":{"type":"integer","title":"Inactive threshold (days)","default":30,"minimum":14,"maximum":180},"batch_size":{"type":"integer","title":"Max subscribers per run","default":100,"minimum":10,"maximum":500},"special_offer":{"type":"string","title":"Special win-back offer (optional)","placeholder":"e.g. 20% off, Free 30-min consultation","default":""}},"required":["brand_name","sender_name"]}', '{"inactive_days":30,"batch_size":100,"special_offer":""}', 7, 0, 4, 1, 1, NULL, 'published', 1777786945, 1777786945);

INSERT OR REPLACE INTO sop_templates (id, slug, name_vi, name_en, description_vi, description_en, category, agents_yaml, playbook_md, output_schema, config_schema, config_defaults, setup_time_minutes, is_featured, credits_per_run, version, is_official, author_user_id, status, created_at, updated_at) VALUES ('sop_official_weekly_newsletter', 'weekly-newsletter', 'Bản Tin Email Hàng Tuần', 'Weekly Newsletter', 'Tự động tổng hợp nội dung từ RSS và analytics để gửi bản tin email hàng tuần', 'Auto-curate content from RSS feeds and analytics to send weekly email newsletter', 'email', 'agents:
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
    backstory: Email delivery and scheduling specialist', '# Weekly Newsletter Playbook

## Step 1: analytics:report
```yaml
type: rss_top_articles
rss_feeds: "{{config.rss_feeds}}"
niche: "{{config.niche}}"
period: last_7_days
limit: 5
```

## Step 2: ai:write
```yaml
task: newsletter
brand_name: "{{config.brand_name}}"
niche: "{{config.niche}}"
articles: "{{step_1.output.articles}}"
editor_intro: "{{config.editor_intro}}"
include_cta: true
cta_text: "{{config.cta_text}}"
tone: "{{config.tone}}"
```

## Step 3: email:campaign
```yaml
type: newsletter
from_name: "{{config.sender_name}}"
subject: "{{step_2.output.subject}}"
html_body: "{{step_2.output.html}}"
list: active_subscribers
track_opens: true
track_clicks: true
```', '{"type":"object","required":["campaignId","recipientCount"],"properties":{"campaignId":{"type":"string"},"recipientCount":{"type":"integer"},"subject":{"type":"string"}}}', '{"properties":{"brand_name":{"type":"string","title":"Newsletter / Brand name","placeholder":"e.g. The Sophia Weekly"},"sender_name":{"type":"string","title":"Sender name","placeholder":"e.g. Nguyen Van A from Sophia"},"niche":{"type":"string","title":"Newsletter topic / niche","placeholder":"e.g. AI marketing, digital agency growth"},"rss_feeds":{"type":"string","title":"RSS feed URLs (comma-separated)","placeholder":"https://blog1.com/rss, https://blog2.com/feed"},"editor_intro":{"type":"string","title":"Editor intro paragraph","placeholder":"Brief weekly message from you to your readers","default":""},"cta_text":{"type":"string","title":"Call-to-action text","placeholder":"e.g. Book a free strategy session","default":""},"tone":{"type":"string","title":"Writing tone","enum":["professional","conversational","educational","witty"],"default":"conversational"}},"required":["brand_name","sender_name","niche"]}', '{"editor_intro":"","cta_text":"","tone":"conversational"}', 8, 1, 3, 1, 1, NULL, 'published', 1777786945, 1777786945);

INSERT OR REPLACE INTO sop_templates (id, slug, name_vi, name_en, description_vi, description_en, category, agents_yaml, playbook_md, output_schema, config_schema, config_defaults, setup_time_minutes, is_featured, credits_per_run, version, is_official, author_user_id, status, created_at, updated_at) VALUES ('sop_official_abandoned_cart_recovery', 'abandoned-cart-recovery', 'Thu Hồi Giỏ Hàng Bỏ Dở', 'Abandoned Cart Recovery', 'Tự động gửi 3 email khi khách hàng bỏ dở giỏ hàng để tăng tỷ lệ chuyển đổi', 'Auto-send 3-email sequence when cart is abandoned to recover lost revenue', 'email', 'agents:
  cart_analyzer:
    role: Cart Analyzer
    goal: Analyze abandoned cart contents and calculate lost value
    tools:
      - analytics:report
    backstory: E-commerce analytics specialist

  recovery_writer:
    role: Recovery Writer
    goal: Write 3-email cart recovery sequence with urgency and social proof
    tools:
      - ai:write
    backstory: E-commerce copywriter specializing in cart abandonment recovery

  email_sender:
    role: Email Sender
    goal: Send timed recovery emails to cart abandoner
    tools:
      - email:campaign
    backstory: Email automation specialist', '# Abandoned Cart Recovery Playbook

Triggered via webhook when cart abandonment is detected.

## Step 1: analytics:report
```yaml
type: cart_details
cart_id: "{{trigger.body.cart_id}}"
customer_email: "{{trigger.body.email}}"
```

## Step 2: ai:write
```yaml
task: cart_recovery_sequence
customer_name: "{{trigger.body.name}}"
cart_items: "{{step_1.output.items}}"
cart_value: "{{step_1.output.total}}"
brand_name: "{{config.brand_name}}"
discount_offer: "{{config.recovery_discount}}"
urgency_hours: 24
emails_count: 3
```

## Step 3: email:campaign
```yaml
type: drip_sequence
to: "{{trigger.body.email}}"
from_name: "{{config.sender_name}}"
sequence: "{{step_2.output.emails}}"
delays_hours: [1, 24, 72]
```', '{"type":"object","required":["sequenceId","scheduledCount"],"properties":{"sequenceId":{"type":"string"},"scheduledCount":{"type":"integer"},"cartValue":{"type":"number"}}}', '{"properties":{"brand_name":{"type":"string","title":"Brand name","placeholder":"e.g. Sophia Shop"},"sender_name":{"type":"string","title":"Sender name","placeholder":"e.g. The Sophia Team"},"recovery_discount":{"type":"string","title":"Recovery discount offer (optional)","placeholder":"e.g. 10% off with code COMEBACK10, free shipping","default":""}},"required":["brand_name","sender_name"]}', '{"recovery_discount":""}', 7, 0, 3, 1, 1, NULL, 'published', 1777786945, 1777786945);

INSERT OR REPLACE INTO sop_templates (id, slug, name_vi, name_en, description_vi, description_en, category, agents_yaml, playbook_md, output_schema, config_schema, config_defaults, setup_time_minutes, is_featured, credits_per_run, version, is_official, author_user_id, status, created_at, updated_at) VALUES ('sop_official_birthday_milestone', 'birthday-milestone', 'Email Sinh Nhật & Kỷ Niệm', 'Birthday & Milestone Email', 'Tự động gửi email cá nhân hóa cho sinh nhật và ngày kỷ niệm của khách hàng', 'Auto-send personalized birthday and anniversary emails to customers', 'email', 'agents:
  milestone_finder:
    role: Milestone Finder
    goal: Find customers with upcoming birthdays or anniversaries today
    tools:
      - analytics:report
    backstory: CRM data analyst

  milestone_writer:
    role: Milestone Writer
    goal: Write personalized milestone emails with special offers
    tools:
      - ai:write
    backstory: Relationship marketing copywriter

  email_sender:
    role: Email Sender
    goal: Send personalized milestone emails
    tools:
      - email:campaign
    backstory: Email automation specialist', '# Birthday & Milestone Email Playbook

## Step 1: analytics:report
```yaml
type: upcoming_milestones
milestone_types:
  - birthday
  - customer_anniversary
lookahead_days: 1
```

## Step 2: ai:write
```yaml
task: milestone_emails
customers: "{{step_1.output.customers}}"
brand_name: "{{config.brand_name}}"
gift_offer: "{{config.birthday_offer}}"
tone: warm_personal
```

## Step 3: email:campaign
```yaml
type: individual_personalized
emails: "{{step_2.output.emails}}"
from_name: "{{config.sender_name}}"
send_at: morning
```', '{"type":"object","required":["sentCount"],"properties":{"sentCount":{"type":"integer"},"milestoneTypes":{"type":"object"}}}', '{"properties":{"brand_name":{"type":"string","title":"Brand name","placeholder":"e.g. Sophia Agency"},"sender_name":{"type":"string","title":"Sender name","placeholder":"e.g. The Sophia Team"},"birthday_offer":{"type":"string","title":"Birthday gift / offer","placeholder":"e.g. 20% birthday discount, free consultation","default":""}},"required":["brand_name","sender_name"]}', '{"birthday_offer":""}', 5, 0, 2, 1, 1, NULL, 'published', 1777786945, 1777786945);

INSERT OR REPLACE INTO sop_templates (id, slug, name_vi, name_en, description_vi, description_en, category, agents_yaml, playbook_md, output_schema, config_schema, config_defaults, setup_time_minutes, is_featured, credits_per_run, version, is_official, author_user_id, status, created_at, updated_at) VALUES ('sop_official_proposal_auto_pilot_v2', 'proposal-auto-pilot-v2', 'Lái Tự Động Đề Xuất', 'Proposal Auto-Pilot', 'Hàng ngày tự động tìm 5 lead inbound, tạo đề xuất cá nhân hóa và gửi ngay', 'Daily: auto-find 5 inbound leads, create personalized proposals, and send immediately', 'sales', 'agents:
  lead_finder:
    role: Lead Finder
    goal: Find {{config.proposals_per_day}} inbound leads ready for proposals
    tools:
      - lead:find
    backstory: Sales operations specialist

  proposal_creator:
    role: Proposal Creator
    goal: Create personalized proposals for each lead
    tools:
      - proposal:create
    backstory: Senior proposal writer with high win rates

  proposal_sender:
    role: Proposal Sender
    goal: Send proposals via email with tracking
    tools:
      - email:campaign
    backstory: Sales enablement specialist', '# Proposal Auto-Pilot Playbook

## Step 1: lead:find
```yaml
status: inbound_qualified
limit: {{config.proposals_per_day}}
sort_by: recency
```

## Step 2: proposal:create
```yaml
leads: "{{step_1.output.leads}}"
service_name: "{{config.service_name}}"
pricing_model: "{{config.pricing_model}}"
starting_price: {{config.starting_price}}
currency: "{{config.currency}}"
include_case_studies: true
```

## Step 3: email:campaign
```yaml
type: individual_proposals
proposals: "{{step_2.output.proposals}}"
from_name: "{{config.sender_name}}"
subject_template: "Proposal for {{lead.company}} — {{service_name}}"
track_opens: true
track_link_clicks: true
```', '{"type":"object","required":["proposals"],"properties":{"proposals":{"type":"array","items":{"type":"object","properties":{"proposalId":{"type":"string"},"leadId":{"type":"string"}},"required":["proposalId","leadId"]},"minItems":1}}}', '{"properties":{"service_name":{"type":"string","title":"Service / product name","placeholder":"e.g. AI Social Media Management"},"sender_name":{"type":"string","title":"Your name (sender)","placeholder":"e.g. Nguyen Van A"},"pricing_model":{"type":"string","title":"Pricing model","enum":["fixed","monthly_retainer","hourly","performance"],"default":"monthly_retainer"},"starting_price":{"type":"integer","title":"Starting price","default":500,"minimum":0},"currency":{"type":"string","title":"Currency","enum":["USD","VND","EUR","SGD"],"default":"USD"},"proposals_per_day":{"type":"integer","title":"Proposals per day","default":5,"minimum":1,"maximum":20}},"required":["service_name","sender_name"]}', '{"pricing_model":"monthly_retainer","starting_price":500,"currency":"USD","proposals_per_day":5}', 5, 1, 5, 1, 1, NULL, 'published', 1777786945, 1777786945);

INSERT OR REPLACE INTO sop_templates (id, slug, name_vi, name_en, description_vi, description_en, category, agents_yaml, playbook_md, output_schema, config_schema, config_defaults, setup_time_minutes, is_featured, credits_per_run, version, is_official, author_user_id, status, created_at, updated_at) VALUES ('sop_official_quote_generator', 'quote-generator', 'Tạo Báo Giá Tự Động', 'Auto Quote Generator', 'Tự động tạo báo giá chuyên nghiệp khi nhận yêu cầu từ khách hàng qua webhook', 'Auto-generate professional quotes when customer request arrives via webhook', 'sales', 'agents:
  quote_calculator:
    role: Quote Calculator
    goal: Calculate quote based on products and quantities
    tools:
      - proposal:create
    backstory: Pricing specialist with product catalog knowledge

  quote_sender:
    role: Quote Sender
    goal: Send formatted quote PDF to customer
    tools:
      - email:campaign
    backstory: Sales enablement specialist', '# Auto Quote Generator Playbook

Triggered via webhook when quote request is received.

## Step 1: proposal:create
```yaml
type: quote
customer_name: "{{trigger.body.customer_name}}"
customer_email: "{{trigger.body.customer_email}}"
items: "{{trigger.body.items}}"
service_name: "{{config.service_name}}"
base_price: {{config.base_price}}
currency: "{{config.currency}}"
validity_days: {{config.quote_validity_days}}
include_terms: true
company_name: "{{config.company_name}}"
```

## Step 2: email:campaign
```yaml
to: "{{trigger.body.customer_email}}"
from_name: "{{config.sender_name}}"
subject: "Quote #{{step_1.output.quoteNumber}} for {{trigger.body.customer_name}}"
attach_pdf: "{{step_1.output.pdfUrl}}"
template: professional_quote
```', '{"type":"object","required":["quoteId","emailId"],"properties":{"quoteId":{"type":"string"},"quoteNumber":{"type":"string"},"emailId":{"type":"string"},"totalAmount":{"type":"number"}}}', '{"properties":{"company_name":{"type":"string","title":"Your company name","placeholder":"e.g. Sophia Agency Co., Ltd."},"service_name":{"type":"string","title":"Default service / product name","placeholder":"e.g. AI Marketing Package"},"sender_name":{"type":"string","title":"Sender name","placeholder":"e.g. Nguyen Van A — Sales"},"base_price":{"type":"integer","title":"Base unit price","default":100,"minimum":0},"currency":{"type":"string","title":"Currency","enum":["USD","VND","EUR","SGD"],"default":"USD"},"quote_validity_days":{"type":"integer","title":"Quote valid for (days)","default":14,"minimum":1,"maximum":90}},"required":["company_name","service_name","sender_name"]}', '{"base_price":100,"currency":"USD","quote_validity_days":14}', 5, 0, 2, 1, 1, NULL, 'published', 1777786945, 1777786945);

INSERT OR REPLACE INTO sop_templates (id, slug, name_vi, name_en, description_vi, description_en, category, agents_yaml, playbook_md, output_schema, config_schema, config_defaults, setup_time_minutes, is_featured, credits_per_run, version, is_official, author_user_id, status, created_at, updated_at) VALUES ('sop_official_post_demo_followup', 'post-demo-followup', 'Theo Dõi Sau Demo', 'Post-Demo Follow-up', 'Chuỗi 5 email theo dõi sau khi khách hàng tham dự demo sản phẩm', '5-touch email follow-up sequence after a product demo', 'sales', 'agents:
  followup_writer:
    role: Followup Writer
    goal: Write 5 post-demo follow-up emails for {{config.product_name}}
    tools:
      - ai:write
    backstory: Sales copywriter with B2B closing expertise

  sequence_sender:
    role: Sequence Sender
    goal: Send timed follow-up sequence to demo prospect
    tools:
      - email:campaign
    backstory: Sales automation specialist', '# Post-Demo Follow-up Playbook

Triggered via webhook after demo is completed.

## Step 1: ai:write
```yaml
task: post_demo_sequence
prospect_name: "{{trigger.body.prospect_name}}"
company: "{{trigger.body.company}}"
product_name: "{{config.product_name}}"
demo_date: "{{trigger.body.demo_date}}"
pain_points_discussed: "{{trigger.body.pain_points}}"
next_step: "{{config.desired_next_step}}"
emails_count: 5
tone: professional_warm
```

## Step 2: email:campaign
```yaml
type: drip_sequence
to: "{{trigger.body.prospect_email}}"
from_name: "{{config.sender_name}}"
sequence: "{{step_1.output.emails}}"
delays_days: [0, 2, 5, 9, 14]
```', '{"type":"object","required":["sequenceId","scheduledCount"],"properties":{"sequenceId":{"type":"string"},"scheduledCount":{"type":"integer"}}}', '{"properties":{"product_name":{"type":"string","title":"Product / service name","placeholder":"e.g. Sophia AI Pro"},"sender_name":{"type":"string","title":"Sales rep name","placeholder":"e.g. Nguyen Van A"},"desired_next_step":{"type":"string","title":"Desired next step after demo","enum":["schedule_trial","send_proposal","book_call","start_now"],"default":"send_proposal"}},"required":["product_name","sender_name"]}', '{"desired_next_step":"send_proposal"}', 7, 0, 3, 1, 1, NULL, 'published', 1777786945, 1777786945);

INSERT OR REPLACE INTO sop_templates (id, slug, name_vi, name_en, description_vi, description_en, category, agents_yaml, playbook_md, output_schema, config_schema, config_defaults, setup_time_minutes, is_featured, credits_per_run, version, is_official, author_user_id, status, created_at, updated_at) VALUES ('sop_official_win_loss_analysis', 'win-loss-analysis', 'Phân Tích Thắng/Thua Tuần', 'Weekly Win/Loss Analysis', 'Hàng tuần phân tích các thương vụ đã đóng để tìm ra pattern thành công', 'Weekly analysis of closed deals to identify winning patterns and blockers', 'sales', 'agents:
  deal_analyst:
    role: Deal Analyst
    goal: Analyze this week closed/lost deals and identify patterns
    tools:
      - analytics:report
    backstory: Revenue analytics expert with CRM expertise

  insights_writer:
    role: Insights Writer
    goal: Write actionable win/loss report with recommendations
    tools:
      - ai:write
    backstory: Business analyst and strategic advisor

  report_sender:
    role: Report Sender
    goal: Send weekly win/loss report to sales team
    tools:
      - email:campaign
    backstory: Sales operations coordinator', '# Weekly Win/Loss Analysis Playbook

## Step 1: analytics:report
```yaml
type: closed_deals
period: last_7_days
include_fields:
  - deal_size
  - close_reason
  - sales_cycle_days
  - lead_source
  - objections
  - competitor
```

## Step 2: ai:write
```yaml
task: win_loss_analysis
deals_data: "{{step_1.output.deals}}"
won_count: "{{step_1.output.won_count}}"
lost_count: "{{step_1.output.lost_count}}"
focus_areas:
  - top_win_reasons
  - top_loss_reasons
  - recommended_improvements
team_size: "{{config.team_size}}"
```

## Step 3: email:campaign
```yaml
type: internal_report
to: "{{config.report_recipients}}"
from_name: "Sophia Sales Analytics"
subject: "Weekly Win/Loss Report — {{step_1.output.week_label}}"
body: "{{step_2.output.report}}"
```', '{"type":"object","required":["reportId","wonCount","lostCount"],"properties":{"reportId":{"type":"string"},"wonCount":{"type":"integer"},"lostCount":{"type":"integer"},"winRate":{"type":"number"}}}', '{"properties":{"report_recipients":{"type":"string","title":"Report recipients (comma-separated emails)","placeholder":"ceo@company.com, sales@company.com","format":"email"},"team_size":{"type":"integer","title":"Sales team size","default":1,"minimum":1,"maximum":100}},"required":["report_recipients"]}', '{"team_size":1}', 5, 0, 2, 1, 1, NULL, 'published', 1777786945, 1777786945);

INSERT OR REPLACE INTO sop_templates (id, slug, name_vi, name_en, description_vi, description_en, category, agents_yaml, playbook_md, output_schema, config_schema, config_defaults, setup_time_minutes, is_featured, credits_per_run, version, is_official, author_user_id, status, created_at, updated_at) VALUES ('sop_official_daily_linkedin_post', 'daily-linkedin-post', 'Bài Đăng LinkedIn Mỗi Ngày', 'Daily LinkedIn Post', 'Tự động tạo và đăng 1 bài thought-leadership trên LinkedIn mỗi ngày', 'Auto-create and publish 1 thought-leadership LinkedIn post daily', 'social', 'agents:
  thought_leader_writer:
    role: Thought Leader Writer
    goal: Write a LinkedIn post establishing {{config.your_name}} as expert in {{config.expertise}}
    tools:
      - ai:write
    backstory: B2B LinkedIn content strategist with 100K+ follower clients

  linkedin_publisher:
    role: LinkedIn Publisher
    goal: Publish post to LinkedIn company or personal page
    tools:
      - social:publish
    backstory: Social media scheduler specialist', '# Daily LinkedIn Post Playbook

## Step 1: analytics:report
```yaml
type: trending_topics
platform: linkedin
niche: "{{config.expertise}}"
period: today
limit: 3
```

## Step 2: ai:write
```yaml
task: linkedin_thought_leader_post
author_name: "{{config.your_name}}"
expertise: "{{config.expertise}}"
trending_topic: "{{step_1.output.topics[0]}}"
post_format: "{{config.post_format}}"
include_cta: true
cta_type: comment_engagement
include_hashtags: true
```

## Step 3: social:publish
```yaml
platform: linkedin
content: "{{step_2.output.post}}"
hashtags: "{{step_2.output.hashtags}}"
publish_time: morning
```', '{"type":"object","required":["postId"],"properties":{"postId":{"type":"string"},"linkedinUrl":{"type":"string"}}}', '{"properties":{"your_name":{"type":"string","title":"Your name / personal brand","placeholder":"e.g. Nguyen Van A"},"expertise":{"type":"string","title":"Your area of expertise","placeholder":"e.g. AI marketing automation, digital agency growth"},"post_format":{"type":"string","title":"Post format","enum":["story","list_tips","opinion","case_study","question"],"default":"list_tips"}},"required":["your_name","expertise"]}', '{"post_format":"list_tips"}', 5, 0, 2, 1, 1, NULL, 'published', 1777786945, 1777786945);

INSERT OR REPLACE INTO sop_templates (id, slug, name_vi, name_en, description_vi, description_en, category, agents_yaml, playbook_md, output_schema, config_schema, config_defaults, setup_time_minutes, is_featured, credits_per_run, version, is_official, author_user_id, status, created_at, updated_at) VALUES ('sop_official_weekly_twitter_thread', 'weekly-twitter-thread', 'Thread Twitter Hàng Tuần', 'Weekly Twitter Thread', 'Tự động tạo và đăng thread 8 tweet mỗi tuần để xây dựng thương hiệu cá nhân trên X', 'Auto-create and post 8-tweet thread weekly to build personal brand on X/Twitter', 'social', 'agents:
  thread_writer:
    role: Thread Writer
    goal: Write viral 8-tweet thread on {{config.topic_theme}} for {{config.author_handle}}
    tools:
      - ai:write
    backstory: Twitter/X thread specialist with viral thread writing expertise

  twitter_publisher:
    role: Twitter Publisher
    goal: Publish thread to Twitter/X account
    tools:
      - social:publish
    backstory: Social media automation specialist', '# Weekly Twitter Thread Playbook

## Step 1: ai:write
```yaml
task: twitter_thread
topic_theme: "{{config.topic_theme}}"
author_handle: "{{config.author_handle}}"
tweet_count: {{config.tweet_count}}
hook_style: "{{config.hook_style}}"
include_cta_last_tweet: true
format: numbered_list
```

## Step 2: social:publish
```yaml
platform: twitter
type: thread
tweets: "{{step_1.output.tweets}}"
schedule: tuesday_9am
```', '{"type":"object","required":["threadId","tweetCount"],"properties":{"threadId":{"type":"string"},"tweetCount":{"type":"integer"},"firstTweetUrl":{"type":"string"}}}', '{"properties":{"author_handle":{"type":"string","title":"Your Twitter/X handle","placeholder":"@yourbrand"},"topic_theme":{"type":"string","title":"Weekly topic theme","placeholder":"e.g. AI tools for agencies, growth hacking, startup lessons"},"tweet_count":{"type":"integer","title":"Number of tweets in thread","default":8,"minimum":5,"maximum":15},"hook_style":{"type":"string","title":"Hook tweet style","enum":["bold_claim","question","story","number_list","controversial"],"default":"bold_claim"}},"required":["author_handle","topic_theme"]}', '{"tweet_count":8,"hook_style":"bold_claim"}', 5, 0, 2, 1, 1, NULL, 'published', 1777786945, 1777786945);

INSERT OR REPLACE INTO sop_templates (id, slug, name_vi, name_en, description_vi, description_en, category, agents_yaml, playbook_md, output_schema, config_schema, config_defaults, setup_time_minutes, is_featured, credits_per_run, version, is_official, author_user_id, status, created_at, updated_at) VALUES ('sop_official_tiktok_hook_ab_test', 'tiktok-hook-ab-test', 'A/B Test Hook TikTok', 'TikTok Hook A/B Test', 'Tự động tạo 5 biến thể hook cho video TikTok để tìm hook có hiệu suất cao nhất', 'Auto-generate 5 hook variants for TikTok videos to find the highest-performing hook', 'social', 'agents:
  hook_generator:
    role: Hook Generator
    goal: Generate 5 different TikTok hook styles for the same video topic
    tools:
      - ai:write
    backstory: TikTok hook specialist who has analyzed 10,000+ viral videos

  hook_analyzer:
    role: Hook Analyzer
    goal: Score each hook variant for virality potential
    tools:
      - analytics:report
    backstory: Viral content analyst', '# TikTok Hook A/B Test Playbook

## Step 1: ai:write
```yaml
task: hook_variants
video_topic: "{{config.video_topic}}"
target_audience: "{{config.target_audience}}"
niche: "{{config.niche}}"
hook_styles:
  - curiosity_gap
  - bold_claim
  - question
  - shocking_stat
  - story_opener
count_per_style: 1
max_words: 15
```

## Step 2: analytics:report
```yaml
type: hook_virality_score
hooks: "{{step_1.output.hooks}}"
platform: tiktok
audience: "{{config.target_audience}}"
```', '{"type":"object","required":["hooks","topHook"],"properties":{"hooks":{"type":"array","items":{"type":"object","properties":{"text":{"type":"string"},"style":{"type":"string"},"viralityScore":{"type":"number"}}}},"topHook":{"type":"string"}}}', '{"properties":{"video_topic":{"type":"string","title":"Video topic","placeholder":"e.g. 5 ways AI saves agency owners 10 hours/week"},"niche":{"type":"string","title":"Content niche","placeholder":"e.g. business, fitness, finance, cooking"},"target_audience":{"type":"string","title":"Target audience","placeholder":"e.g. small business owners, college students"}},"required":["video_topic","niche"]}', '{}', 5, 0, 3, 1, 1, NULL, 'published', 1777786945, 1777786945);

INSERT OR REPLACE INTO sop_templates (id, slug, name_vi, name_en, description_vi, description_en, category, agents_yaml, playbook_md, output_schema, config_schema, config_defaults, setup_time_minutes, is_featured, credits_per_run, version, is_official, author_user_id, status, created_at, updated_at) VALUES ('sop_official_comment_auto_reply', 'comment-auto-reply', 'Tự Động Phản Hồi Bình Luận (BETA)', 'Comment Auto-Reply (BETA)', 'Tự động phân loại và phản hồi bình luận trên mạng xã hội bằng AI — tính năng thử nghiệm', 'Auto-classify and reply to social media comments using AI — BETA feature', 'social', 'agents:
  comment_fetcher:
    role: Comment Fetcher
    goal: Fetch new unanswered comments from connected platforms
    tools:
      - social:get_comments
    backstory: Social media monitoring specialist (BETA)

  reply_writer:
    role: Reply Writer
    goal: Write appropriate AI replies for each comment type
    tools:
      - ai:write
    backstory: Community manager trained on brand voice guidelines

  reply_publisher:
    role: Reply Publisher
    goal: Post replies to matching comments (BETA)
    tools:
      - social:reply_comment
    backstory: Social media automation specialist (BETA)', '# Comment Auto-Reply Playbook (BETA)

> **BETA**: Requires platform API access for comment reading/writing.
> Currently supported: Instagram (business accounts), Facebook Pages.

## Step 1: social:get_comments
```yaml
platform: "{{config.platform}}"
status: unanswered
limit: 20
sentiment_filter: all
```

## Step 2: ai:write
```yaml
task: comment_replies
comments: "{{step_1.output.comments}}"
brand_name: "{{config.brand_name}}"
brand_voice: "{{config.tone}}"
reply_rules:
  - type: question
    strategy: helpful_answer
  - type: complaint
    strategy: empathetic_escalate
  - type: compliment
    strategy: grateful_engage
  - type: spam
    strategy: skip
```

## Step 3: social:reply_comment
```yaml
platform: "{{config.platform}}"
replies: "{{step_2.output.replies}}"
require_approval_for_complaints: {{config.approve_complaints}}
```', '{"type":"object","required":["repliedCount"],"properties":{"repliedCount":{"type":"integer"},"skippedCount":{"type":"integer"},"pendingApprovalCount":{"type":"integer"}}}', '{"properties":{"platform":{"type":"string","title":"Social platform","enum":["instagram","facebook"],"default":"instagram"},"brand_name":{"type":"string","title":"Brand name","placeholder":"e.g. Sophia Agency"},"tone":{"type":"string","title":"Reply tone","enum":["professional","friendly","casual","formal"],"default":"friendly"},"approve_complaints":{"type":"boolean","title":"Require approval before replying to complaints","default":true}},"required":["brand_name"]}', '{"platform":"instagram","tone":"friendly","approve_complaints":true}', 8, 0, 4, 1, 1, NULL, 'published', 1777786945, 1777786945);

INSERT OR REPLACE INTO sop_templates (id, slug, name_vi, name_en, description_vi, description_en, category, agents_yaml, playbook_md, output_schema, config_schema, config_defaults, setup_time_minutes, is_featured, credits_per_run, version, is_official, author_user_id, status, created_at, updated_at) VALUES ('sop_official_weekly_performance_report_v2', 'weekly-performance-report-v2', 'Báo Cáo Hiệu Suất Hàng Tuần', 'Weekly Performance Report', 'Tự động truy vấn analytics và gửi báo cáo tóm tắt hiệu suất hàng tuần qua email', 'Auto-query analytics and send weekly performance summary email to your team', 'analytics', 'agents:
  analytics_reporter:
    role: Analytics Reporter
    goal: Generate weekly performance metrics for {{config.report_scope}}
    tools:
      - analytics:report
    backstory: Data analytics specialist

  insights_writer:
    role: Insights Writer
    goal: Write executive summary with key insights and recommendations
    tools:
      - ai:write
    backstory: Business intelligence writer

  report_sender:
    role: Report Sender
    goal: Email the weekly report to stakeholders
    tools:
      - email:campaign
    backstory: Report distribution specialist', '# Weekly Performance Report Playbook

## Step 1: analytics:report
```yaml
scope: "{{config.report_scope}}"
period: last_7_days
metrics:
  - revenue
  - leads_generated
  - email_open_rate
  - social_engagement
  - video_views
  - campaigns_sent
compare_to_previous: true
```

## Step 2: ai:write
```yaml
task: executive_summary
metrics_data: "{{step_1.output.metrics}}"
previous_period: "{{step_1.output.previous}}"
highlights_count: 3
include_recommendations: true
format: "{{config.report_format}}"
```

## Step 3: email:campaign
```yaml
type: report
to: "{{config.report_recipients}}"
from_name: "Sophia Analytics"
subject: "Weekly Performance Report — {{step_1.output.week_label}}"
html_body: "{{step_2.output.html}}"
```', '{"type":"object","required":["reportId","emailId","metricsSnapshot"],"properties":{"reportId":{"type":"string"},"emailId":{"type":"string"},"metricsSnapshot":{"type":"object"}}}', '{"properties":{"report_recipients":{"type":"string","title":"Report recipients (comma-separated emails)","placeholder":"you@company.com, manager@company.com"},"report_scope":{"type":"string","title":"Report scope","enum":["all_channels","social_only","email_only","leads_only","revenue_only"],"default":"all_channels"},"report_format":{"type":"string","title":"Report format","enum":["executive_brief","detailed","visual_charts"],"default":"executive_brief"}},"required":["report_recipients"]}', '{"report_scope":"all_channels","report_format":"executive_brief"}', 5, 1, 2, 1, 1, NULL, 'published', 1777786945, 1777786945);

INSERT OR REPLACE INTO sop_templates (id, slug, name_vi, name_en, description_vi, description_en, category, agents_yaml, playbook_md, output_schema, config_schema, config_defaults, setup_time_minutes, is_featured, credits_per_run, version, is_official, author_user_id, status, created_at, updated_at) VALUES ('sop_official_monthly_dashboard_pdf', 'monthly-dashboard-pdf', 'Báo Cáo PDF Tháng', 'Monthly Dashboard PDF', 'Tự động tạo và gửi email báo cáo hiệu suất PDF hàng tháng cho khách hàng hoặc nhóm', 'Auto-generate and email monthly performance PDF report to clients or team', 'analytics', 'agents:
  monthly_analyzer:
    role: Monthly Analyzer
    goal: Compile full month metrics and compare to previous month
    tools:
      - analytics:report
    backstory: Business intelligence analyst

  pdf_generator:
    role: PDF Generator
    goal: Generate professional PDF dashboard with charts
    tools:
      - report:generate_pdf
    backstory: Data visualization and report design specialist

  pdf_sender:
    role: PDF Sender
    goal: Email PDF report to client or internal team
    tools:
      - email:campaign
    backstory: Client communication specialist', '# Monthly Dashboard PDF Playbook

## Step 1: analytics:report
```yaml
period: last_30_days
compare_previous: true
include_channels:
  - social_media
  - email_campaigns
  - leads
  - revenue
group_by: week
```

## Step 2: report:generate_pdf
```yaml
report_data: "{{step_1.output.metrics}}"
title: "{{config.report_title}}"
brand_color: "{{config.brand_color}}"
logo_url: "{{config.logo_url}}"
include_charts: true
sections:
  - executive_summary
  - channel_breakdown
  - goals_progress
  - recommendations
```

## Step 3: email:campaign
```yaml
to: "{{config.report_recipients}}"
from_name: "{{config.sender_name}}"
subject: "{{config.report_title}} — {{step_1.output.month_label}}"
body: "Please find attached your monthly performance report."
attachment_url: "{{step_2.output.pdfUrl}}"
```', '{"type":"object","required":["pdfUrl","emailId"],"properties":{"pdfUrl":{"type":"string"},"emailId":{"type":"string"},"month":{"type":"string"}}}', '{"properties":{"report_title":{"type":"string","title":"Report title","default":"Monthly Performance Report","placeholder":"e.g. Sophia Agency Monthly Report"},"sender_name":{"type":"string","title":"Sender name","placeholder":"e.g. Sophia Analytics Team"},"report_recipients":{"type":"string","title":"Recipients (comma-separated emails)","placeholder":"client@company.com, you@agency.com"},"brand_color":{"type":"string","title":"Brand color (hex)","placeholder":"#6d28d9","default":"#6d28d9"},"logo_url":{"type":"string","title":"Company logo URL","placeholder":"https://your-site.com/logo.png","default":""}},"required":["sender_name","report_recipients"]}', '{"report_title":"Monthly Performance Report","brand_color":"#6d28d9","logo_url":""}', 7, 0, 3, 1, 1, NULL, 'published', 1777786945, 1777786945);

INSERT OR REPLACE INTO sop_templates (id, slug, name_vi, name_en, description_vi, description_en, category, agents_yaml, playbook_md, output_schema, config_schema, config_defaults, setup_time_minutes, is_featured, credits_per_run, version, is_official, author_user_id, status, created_at, updated_at) VALUES ('sop_official_daily_anomaly_alerts', 'daily-anomaly-alerts', 'Cảnh Báo Bất Thường Hàng Ngày', 'Daily Anomaly Alerts', 'Phát hiện sự thay đổi bất thường trong các chỉ số quan trọng và gửi cảnh báo ngay lập tức', 'Detect unusual drops or spikes in key metrics and send instant alerts', 'analytics', 'agents:
  anomaly_detector:
    role: Anomaly Detector
    goal: Scan key metrics for unusual changes vs 7-day baseline
    tools:
      - analytics:report
    backstory: Statistical anomaly detection specialist

  alert_writer:
    role: Alert Writer
    goal: Write clear alert message with root cause hypothesis
    tools:
      - ai:write
    backstory: Technical writer specializing in operational alerts

  alert_sender:
    role: Alert Sender
    goal: Send critical alerts to configured channels
    tools:
      - email:campaign
    backstory: Incident notification specialist', '# Daily Anomaly Alerts Playbook

## Step 1: analytics:report
```yaml
type: anomaly_detection
metrics: "{{config.monitored_metrics}}"
baseline_days: 7
threshold_percentage: {{config.alert_threshold}}
include_charts: true
```

## Step 2: ai:write
```yaml
task: anomaly_alert_message
anomalies: "{{step_1.output.anomalies}}"
context: "{{step_1.output.baseline}}"
include_hypothesis: true
urgency_level: "{{step_1.output.max_severity}}"
```

## Step 3: email:campaign
```yaml
to: "{{config.alert_recipients}}"
from_name: "Sophia Monitoring"
subject: "⚠️ Anomaly Detected — {{step_1.output.anomaly_summary}}"
body: "{{step_2.output.alert_message}}"
priority: high
```', '{"type":"object","required":["anomalyCount","alertSent"],"properties":{"anomalyCount":{"type":"integer"},"alertSent":{"type":"boolean"},"severity":{"type":"string","enum":["low","medium","high","critical"]}}}', '{"properties":{"alert_recipients":{"type":"string","title":"Alert recipients (comma-separated emails)","placeholder":"you@company.com"},"monitored_metrics":{"type":"string","title":"Metrics to monitor (comma-separated)","default":"revenue,leads,email_open_rate,social_engagement","placeholder":"revenue,leads,email_open_rate"},"alert_threshold":{"type":"integer","title":"Alert threshold (% change)","description":"Send alert when metric changes by more than this %","default":20,"minimum":5,"maximum":80}},"required":["alert_recipients"]}', '{"monitored_metrics":"revenue,leads,email_open_rate,social_engagement","alert_threshold":20}', 5, 0, 2, 1, 1, NULL, 'published', 1777786945, 1777786945);

INSERT OR REPLACE INTO sop_templates (id, slug, name_vi, name_en, description_vi, description_en, category, agents_yaml, playbook_md, output_schema, config_schema, config_defaults, setup_time_minutes, is_featured, credits_per_run, version, is_official, author_user_id, status, created_at, updated_at) VALUES ('sop_official_mention_monitor_respond', 'mention-monitor-respond', 'Theo Dõi & Phản Hồi Đề Cập', 'Brand Mention Monitor & Respond', 'Theo dõi đề cập thương hiệu và soạn thảo phản hồi — yêu cầu phê duyệt trước khi gửi', 'Monitor brand mentions and draft responses — requires human approval before sending', 'crisis', 'agents:
  mention_monitor:
    role: Mention Monitor
    goal: Detect all mentions of {{config.brand_name}} across platforms
    tools:
      - analytics:report
    backstory: Brand monitoring specialist with cross-platform coverage

  sentiment_classifier:
    role: Sentiment Classifier
    goal: Classify mentions by sentiment and urgency level
    tools:
      - ai:write
    backstory: Sentiment analysis expert

  response_drafter:
    role: Response Drafter
    goal: Draft appropriate responses for negative mentions
    tools:
      - proposal:create
    backstory: Crisis communication specialist and PR expert', '# Brand Mention Monitor & Respond Playbook

## Step 1: analytics:report
```yaml
type: brand_mentions
keywords:
  - "{{config.brand_name}}"
  - "{{config.brand_aliases}}"
platforms:
  - google
  - facebook
  - twitter
  - tiktok
period: last_24_hours
sentiment: all
```

## Step 2: ai:write
```yaml
task: classify_mentions
mentions: "{{step_1.output.mentions}}"
severity_levels:
  critical: ["lawsuit", "scam", "fraud", "complaint"]
  high: ["negative review", "bad experience", "disappointed"]
  low: ["question", "neutral mention"]
```

## Step 3: proposal:create
```yaml
type: crisis_response_drafts
classified_mentions: "{{step_2.output.classified}}"
brand_name: "{{config.brand_name}}"
response_tone: "{{config.response_tone}}"
escalate_critical: true
requires_approval: true
```', '{"type":"object","required":["mentionsReport","draftResponseId","requiresApproval"],"properties":{"mentionsReport":{"type":"object"},"draftResponseId":{"type":"string"},"requiresApproval":{"type":"boolean","const":true},"criticalCount":{"type":"integer"}}}', '{"properties":{"brand_name":{"type":"string","title":"Brand name to monitor","placeholder":"e.g. Sophia Agency"},"brand_aliases":{"type":"string","title":"Brand aliases / variations (comma-separated)","placeholder":"e.g. SophiaAI, Sophia.ai, @sophia_agency","default":""},"response_tone":{"type":"string","title":"Crisis response tone","enum":["professional_empathetic","formal","friendly_resolving"],"default":"professional_empathetic"},"alert_recipients":{"type":"string","title":"Alert recipients for critical mentions","placeholder":"ceo@company.com, pr@company.com"}},"required":["brand_name"]}', '{"brand_aliases":"","response_tone":"professional_empathetic"}', 5, 1, 3, 1, 1, NULL, 'published', 1777786945, 1777786945);

INSERT OR REPLACE INTO sop_templates (id, slug, name_vi, name_en, description_vi, description_en, category, agents_yaml, playbook_md, output_schema, config_schema, config_defaults, setup_time_minutes, is_featured, credits_per_run, version, is_official, author_user_id, status, created_at, updated_at) VALUES ('sop_official_negative_review_classify', 'negative-review-classify', 'Phân Loại Đánh Giá Tiêu Cực', 'Negative Review Classifier', 'Tự động phân loại đánh giá tiêu cực và gửi cảnh báo ngay khi có review nghiêm trọng', 'Auto-classify negative reviews and instantly alert team when critical reviews appear', 'crisis', 'agents:
  review_fetcher:
    role: Review Fetcher
    goal: Fetch new reviews from Google, Facebook, and other platforms
    tools:
      - analytics:report
    backstory: Review monitoring specialist

  review_classifier:
    role: Review Classifier
    goal: Classify reviews by severity and category
    tools:
      - ai:write
    backstory: Sentiment analysis and review categorization expert

  alert_sender:
    role: Alert Sender
    goal: Send critical review alerts to team
    tools:
      - email:campaign
    backstory: Customer experience operations specialist', '# Negative Review Classifier Playbook

## Step 1: analytics:report
```yaml
type: new_reviews
brand_name: "{{config.brand_name}}"
platforms:
  - google_business
  - facebook
  - tripadvisor
period: last_24_hours
rating_filter: negative
```

## Step 2: ai:write
```yaml
task: classify_reviews
reviews: "{{step_1.output.reviews}}"
categories:
  - service_quality
  - product_defect
  - delivery_issue
  - pricing_complaint
  - staff_behavior
severity_mapping:
  1_star: critical
  2_star: high
  3_star: medium
suggest_response: true
```

## Step 3: email:campaign
```yaml
type: review_alert
to: "{{config.alert_recipients}}"
from_name: "Sophia Review Monitor"
subject: "⚠️ {{step_1.output.new_count}} New Negative Reviews — Action Required"
reviews_with_suggestions: "{{step_2.output.classified}}"
include_response_drafts: true
```', '{"type":"object","required":["reviewCount","criticalCount"],"properties":{"reviewCount":{"type":"integer"},"criticalCount":{"type":"integer"},"categories":{"type":"object"},"alertSent":{"type":"boolean"}}}', '{"properties":{"brand_name":{"type":"string","title":"Business name to monitor","placeholder":"e.g. Sophia Agency"},"alert_recipients":{"type":"string","title":"Alert recipients (comma-separated)","placeholder":"manager@company.com, customer-service@company.com"},"min_severity_to_alert":{"type":"string","title":"Minimum severity to trigger alert","enum":["critical","high","medium"],"default":"high"}},"required":["brand_name","alert_recipients"]}', '{"min_severity_to_alert":"high"}', 5, 0, 2, 1, 1, NULL, 'published', 1777786945, 1777786945);
