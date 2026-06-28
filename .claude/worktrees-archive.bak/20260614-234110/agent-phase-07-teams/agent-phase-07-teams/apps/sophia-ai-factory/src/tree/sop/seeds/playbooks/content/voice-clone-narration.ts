/**
 * Seed: Voice Clone Narration (BETA)
 * Clone voice + generate AI narration for product videos.
 * Category: content | Status: beta stub
 */

import type { SopSeedEntry } from '../../index';

export const slug = 'voice-clone-narration';

export const template: SopSeedEntry = {
  slug,
  nameVi: 'Nhân Bản Giọng Nói AI (BETA)',
  nameEn: 'Voice Clone Narration (BETA)',
  descVi: 'Nhân bản giọng nói và tạo narration AI cho video sản phẩm — tính năng thử nghiệm',
  descEn: 'Clone your voice and generate AI narration for product videos — BETA feature',
  category: 'content',
  creditsPerRun: 10,
  setupTimeMinutes: 10,
  isFeatured: 0,
  agentsYaml: `agents:
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
    backstory: Video post-production engineer`,
  playbookMd: `# Voice Clone Narration Playbook (BETA)

## Step 1: ai:write
\`\`\`yaml
task: product_narration_script
product_name: "{{config.product_name}}"
key_benefits: "{{config.key_benefits}}"
duration_seconds: {{config.duration_seconds}}
tone: "{{config.tone}}"
\`\`\`

## Step 2: voice:clone_narrate
\`\`\`yaml
text: "{{step_1.output.script}}"
voice_profile_id: "{{config.voice_profile_id}}"
speed: 1.0
\`\`\`

## Step 3: video:merge_audio
\`\`\`yaml
video_url: "{{config.video_url}}"
audio_url: "{{step_2.output.audioUrl}}"
replace_original_audio: true
\`\`\``,
  outputSchema: JSON.stringify({
    type: 'object',
    required: ['outputVideoUrl'],
    properties: {
      outputVideoUrl: { type: 'string' },
      audioUrl: { type: 'string' },
      script: { type: 'string' },
    },
  }),
  configSchema: JSON.stringify({
    properties: {
      product_name: {
        type: 'string',
        title: 'Product name',
        placeholder: 'e.g. Sophia AI Pro Plan',
      },
      key_benefits: {
        type: 'string',
        title: 'Key benefits (comma-separated)',
        placeholder: 'e.g. saves 10 hours/week, automates social media',
      },
      video_url: {
        type: 'string',
        title: 'Source video URL',
        placeholder: 'https://...',
      },
      voice_profile_id: {
        type: 'string',
        title: 'Voice profile ID (from ElevenLabs)',
        placeholder: 'elevenlabs_voice_xxxxx',
      },
      duration_seconds: {
        type: 'integer',
        title: 'Target duration (seconds)',
        default: 60,
        minimum: 15,
        maximum: 180,
      },
      tone: {
        type: 'string',
        title: 'Narration tone',
        enum: ['professional', 'conversational', 'enthusiastic'],
        default: 'professional',
      },
    },
    required: ['product_name', 'key_benefits'],
  }),
  configDefaults: JSON.stringify({
    duration_seconds: 60,
    tone: 'professional',
  }),
};
