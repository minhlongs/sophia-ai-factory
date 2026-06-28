/**
 * Seed: Daily Content Factory SOP
 * Generates 3 videos + email digest daily.
 * Category: content | Credits: 10
 */

export const slug = 'daily-content-factory';
export const nameVi = 'Nhà Máy Nội Dung Hàng Ngày';
export const nameEn = 'Daily Content Factory';
export const descVi = 'Tự động tạo 3 video AI và gửi email digest hàng ngày cho khách hàng';
export const descEn = 'Auto-generate 3 AI avatar videos and send a daily email digest to customers';
export const category = 'content';
export const creditsPerRun = 10;

export const agentsYaml = `
agents:
  content_planner:
    role: Content Planner
    goal: Plan 3 daily content topics aligned with brand voice
    tools:
      - analytics:report
    backstory: Expert content strategist with deep knowledge of viral content patterns

  video_creator:
    role: Video Creator
    goal: Create AI avatar videos for each planned topic
    tools:
      - video:create
    backstory: AI video production specialist using HeyGen avatars

  email_publisher:
    role: Email Publisher
    goal: Compile and send daily video digest email to subscribers
    tools:
      - email:campaign
    backstory: Email marketing expert focused on engagement and open rates
`.trim();

export const playbookMd = `
# Daily Content Factory Playbook

## Step 1: analytics:report
\`\`\`yaml
type: topics
limit: 3
period: yesterday
\`\`\`

## Step 2: video:create
\`\`\`yaml
topic: "{{step_1.output.topics[0]}}"
avatar_id: default
duration: 60
\`\`\`

## Step 3: video:create
\`\`\`yaml
topic: "{{step_1.output.topics[1]}}"
avatar_id: default
duration: 60
\`\`\`

## Step 4: video:create
\`\`\`yaml
topic: "{{step_1.output.topics[2]}}"
avatar_id: default
duration: 60
\`\`\`

## Step 5: email:campaign
\`\`\`yaml
subject: "Your Daily Video Digest"
template: daily_digest
video_ids:
  - "{{step_2.output.videoId}}"
  - "{{step_3.output.videoId}}"
  - "{{step_4.output.videoId}}"
\`\`\`
`.trim();

export const outputSchema = JSON.stringify({
  type: 'object',
  required: ['videos', 'emailId'],
  properties: {
    videos: {
      type: 'array',
      items: { type: 'object', properties: { videoId: { type: 'string' } }, required: ['videoId'] },
      minItems: 3,
      maxItems: 3,
    },
    emailId: { type: 'string' },
  },
});
