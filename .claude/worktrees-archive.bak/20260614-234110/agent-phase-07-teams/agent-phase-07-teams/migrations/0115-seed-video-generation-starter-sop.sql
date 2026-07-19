-- Migration 0115: Seed `video-generation-starter` SOP template.
--
-- Why: handover audit 2026-05-18 found `installStarterSop()` silently skips
-- because the row does not exist. Every new MASTER user (FREE100 redeem +
-- paid handover) was getting zero starter SOPs.
--
-- Idempotent: INSERT OR IGNORE so re-applying is a no-op.

INSERT OR IGNORE INTO sop_templates (
  id, slug, name_vi, name_en, description_vi, description_en, category,
  agents_yaml, playbook_md, output_schema, config_schema, config_defaults,
  setup_time_minutes, is_featured, credits_per_run, version, is_official,
  author_user_id, status, created_at, updated_at
) VALUES (
  'sop_starter_video_generation_v1',
  'video-generation-starter',
  'Bắt đầu — Tạo video AI đầu tiên',
  'Starter — Your First AI Video',
  'SOP khởi đầu dành cho người mới: viết script ngắn → tạo video AI (HeyGen / D-ID) → tải xuống. Tự động lưu lại trong thư viện. Chạy được ngay khi bạn đã nhập API key trong Setup Wizard.',
  'Beginner-friendly starter SOP: write a short script → generate an AI video (HeyGen / D-ID) → download. Saved automatically to your library. Runs as soon as your provider API key is configured in Setup Wizard.',
  'content',
  'agents:
  script_writer:
    role: Script Writer
    goal: Write a 30-second video script about {{config.topic}}
    tools:
      - ai:write
    backstory: Concise short-form video scriptwriter
  video_creator:
    role: Video Creator
    goal: Render an AI avatar video from the script using the customer''s configured provider
    tools:
      - video:create_heygen
    backstory: Avatar video generator powered by customer BYOK key',
  '# Video Generation Starter Playbook

> First-time onboarding SOP. Designed to confirm BYOK keys work end-to-end.

## Step 1: ai:write
```yaml
task: short_video_script
topic: "{{config.topic}}"
duration_seconds: 30
tone: "{{config.tone}}"
language: "{{config.locale}}"
```
Output: `script` (string, 80-120 words)

## Step 2: video:create_heygen
```yaml
script: "{{steps.script_writer.script}}"
avatar_id: "{{config.avatar_id}}"
voice_id: "{{config.voice_id}}"
locale: "{{config.locale}}"
```
Output: `videoUrl` (string)

## Success criteria
- Script length 80-120 words
- Video duration 25-35 seconds
- Provider returned 200 OK and a downloadable URL

## Troubleshooting
- **No video URL returned** → check Setup Wizard → HeyGen / D-ID API key
- **Avatar not found** → use the default avatar suggested in Settings → Avatars
- **Script too long** → reduce `duration_seconds` in config

---

# Hướng dẫn Starter — Tạo video AI đầu tiên

## Bước 1: Viết script bằng AI
Bot tự viết một script video 30 giây về chủ đề bạn nhập (`config.topic`), giọng văn theo `config.tone`.

## Bước 2: Render video AI
Hệ thống dùng API key HeyGen/D-ID đã nhập trong Setup Wizard để tạo video.

## Tiêu chí thành công
- Script dài 80-120 từ
- Video dài 25-35 giây
- Provider trả về URL tải về được

## Khắc phục sự cố
- **Không có URL** → kiểm tra Setup Wizard → API key của HeyGen / D-ID
- **Không tìm thấy Avatar** → chọn avatar mặc định trong Settings → Avatars
- **Script quá dài** → giảm `duration_seconds` trong config
',
  '{"type":"object","required":["videoUrl"],"properties":{"videoUrl":{"type":"string","format":"uri"},"script":{"type":"string"},"durationSeconds":{"type":"number"}}}',
  '{"type":"object","required":["topic","locale"],"properties":{"topic":{"type":"string","minLength":3,"maxLength":80,"description":"Chủ đề video / Video topic"},"tone":{"type":"string","enum":["friendly","professional","energetic"],"default":"friendly"},"locale":{"type":"string","enum":["vi","en"],"default":"vi"},"avatar_id":{"type":"string","description":"HeyGen avatar id (xem trong Settings)"},"voice_id":{"type":"string","description":"HeyGen voice id (xem trong Settings)"}}}',
  '{"topic":"Giới thiệu sản phẩm của tôi","tone":"friendly","locale":"vi"}',
  5,
  1,
  5,
  1,
  1,
  NULL,
  'published',
  CAST(strftime('%s','now') AS INTEGER),
  CAST(strftime('%s','now') AS INTEGER)
);
