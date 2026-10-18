/**
 * Playbook markdown content for Weekly Newsletter SOP seed.
 * Category: email
 */

export const WEEKLY_NEWSLETTER_PLAYBOOK_MD = `# Weekly Newsletter Playbook

## Step 1: analytics:report
\`\`\`yaml
type: rss_top_articles
rss_feeds: "{{config.rss_feeds}}"
niche: "{{config.niche}}"
period: last_7_days
limit: 5
\`\`\`

## Step 2: ai:write
\`\`\`yaml
task: newsletter
brand_name: "{{config.brand_name}}"
niche: "{{config.niche}}"
articles: "{{step_1.output.articles}}"
editor_intro: "{{config.editor_intro}}"
include_cta: true
cta_text: "{{config.cta_text}}"
tone: "{{config.tone}}"
\`\`\`

## Step 3: email:campaign
\`\`\`yaml
type: newsletter
from_name: "{{config.sender_name}}"
subject: "{{step_2.output.subject}}"
html_body: "{{step_2.output.html}}"
list: active_subscribers
track_opens: true
track_clicks: true
\`\`\``;
