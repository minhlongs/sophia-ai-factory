-- Migration 0117: Refresh starter video SOP to the current 3-step user flow.
--
-- Why: production had the legacy 0115 seed using video:create_heygen and no
-- distribution step. The dashboard starter flow must run:
-- ai:write -> video:create -> social:publish.

UPDATE sop_templates
SET
  name_vi = 'Tạo & Phân Phối Video AI Đầu Tiên',
  name_en = 'Generate & Distribute Your First AI Video',
  description_vi = 'Tạo video AI từ prompt văn bản, ghép giọng đọc, sau đó tự động phân phối lên kênh đã kết nối',
  description_en = 'Generate an AI avatar video from a text prompt, add voiceover, then auto-distribute to your connected channels',
  agents_yaml = 'agents:
  script_writer:
    role: Script Writer
    goal: Write a short engaging video script for {{config.topic}}
    tools:
      - ai:write
    backstory: Short-form video copywriter specialising in AI-powered content

  video_producer:
    role: Video Producer
    goal: Produce an AI avatar video using the generated script
    tools:
      - video:create
    backstory: AI video production specialist using avatar synthesis

  distributor:
    role: Content Distributor
    goal: Publish the finished video to all connected channels
    tools:
      - social:publish
    backstory: Multi-channel distribution expert',
  playbook_md = '# Generate & Distribute Your First AI Video

## Step 1: ai:write
```yaml
task: video_script
topic: "{{config.topic}}"
tone: "{{config.tone}}"
duration_seconds: 60
language: "{{config.language}}"
include_cta: true
```

## Step 2: video:create
```yaml
script: "{{step_1.output.script}}"
avatar_id: default
voiceover_language: "{{config.language}}"
format: vertical_9x16
duration: 60
```

## Step 3: social:publish
```yaml
platform: all_connected
video_id: "{{step_2.output.videoId}}"
caption: "{{step_1.output.caption}}"
hashtags: "{{step_1.output.hashtags}}"
schedule: now
```',
  output_schema = '{"type":"object","required":["videoId","publishedChannels"],"properties":{"videoId":{"type":"string"},"publishedChannels":{"type":"array","items":{"type":"string"}}}}',
  config_schema = '{"properties":{"topic":{"type":"string","title":"Video topic","description":"What is your video about?","placeholder":"e.g. How AI helps agencies save 10 hours per week"},"tone":{"type":"string","title":"Tone","enum":["professional","casual","educational","inspiring"],"default":"professional"},"language":{"type":"string","title":"Script language","enum":["en","vi"],"default":"en"}},"required":["topic"]}',
  config_defaults = '{"tone":"professional","language":"en"}',
  credits_per_run = 5,
  setup_time_minutes = 3,
  is_featured = 1,
  version = version + 1,
  status = 'published',
  updated_at = CAST(strftime('%s','now') AS INTEGER)
WHERE slug = 'video-generation-starter';
