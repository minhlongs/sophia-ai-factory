---
description: 📱 Social Media Content — Posts, Threads, Captions, Hashtags
argument-hint: [platform: twitter|linkedin|facebook|instagram|all] [topic]
---

**Think harder** để tạo social media content: <platform>$ARGUMENTS</platform>

**IMPORTANT:** Content phải platform-specific — không copy-paste cùng content everywhere.

## Platform Specifications

| Platform | Length | Best Time | Hashtags | Media |
|----------|--------|-----------|----------|-------|
| Twitter/X | 280 chars | 9-11 AM | 1-3 | Optional |
| LinkedIn | 1,300 chars | 8-10 AM | 3-5 | Recommended |
| Facebook | 400 chars | 1-3 PM | 0-2 | Recommended |
| Instagram | 2,200 chars | 11 AM-1 PM | 5-11 | Required |
| Threads | 500 chars | 10 AM-12 PM | 0-3 | Optional |

## Content Templates

### Twitter Thread Template
```
Tweet 1/10: Hook
🧵 Big announcement! We just [achievement] and here's what you need to know:

Tweet 2/10: Context
Before this, [problem] was a nightmare. Agencies wasted 20+ hours/week on...

Tweet 3/10: Solution
That's why we built [feature]. It does [magic] automatically.

Tweet 4-8/10: How it works
Step-by-step breakdown with screenshots

Tweet 9/10: Results
In beta, customers saw:
• 10x faster operations
• 80% cost reduction
• 100% happier teams

Tweet 10/10: CTA
Ready to try? Sign up at [link] or DM for early access!

#AI #Automation #SaaS
```

### LinkedIn Post Template
```
[Attention-grabbing first line]

[Blank line for "see more"]

[Story/Problem]
Last quarter, we faced a huge challenge: [describe problem].

[Struggle/Journey]
We tried everything:
❌ Solution A (didn't work)
❌ Solution B (too expensive)
❌ Solution C (too complex)

[Breakthrough]
Then we realized: [key insight].

[Solution/Result]
Built [product] that delivers:
✅ Benefit 1
✅ Benefit 2
✅ Benefit 3

[Social Proof]
"[Testimonial]" — Customer, $X ARR

[CTA]
Want similar results? Let's talk: [link]

#Hashtag1 #Hashtag2 #Hashtag3
```

### Instagram Caption Template
```
[Emoji] Main message that stops the scroll

[Line break]

[Story/context - 2-3 sentences]

[Line break]

[Value/Tip/Insight]
💡 Here's what we learned:
• Point 1
• Point 2
• Point 3

[Line break]

[CTA: Save, Share, Comment]

[Line break]

[Hashtags: 5-11 relevant tags]
#AgencyLife #Automation #AI #Productivity #TechStartup
```

## Content Generation Commands

### `twitter` — Twitter/X Content
```bash
# Generate tweet thread
node scripts/generate-tweet.js \
  --topic "AgencyOS raises $5M seed" \
  --tone "exciting" \
  --length 10 \
  --output content/twitter-thread.md

# Schedule tweets
curl -X POST "https://api.twitter.com/2/tweets" \
  -H "Authorization: Bearer $TWITTER_TOKEN" \
  -d '{"text": "🚀 Exciting news!..."}'

# Analytics
curl -s "https://api.twitter.com/2/users/me/tweets" \
  -H "Authorization: Bearer $TWITTER_TOKEN" \
  | jq '.data[] | {id, text, public_metrics}'
```

### `linkedin` — LinkedIn Content
```bash
# Generate LinkedIn post
node scripts/generate-linkedin.js \
  --topic "Lessons from scaling to 100 customers" \
  --format "story" \
  --include-cta \
  --output content/linkedin-post.md

# Post to LinkedIn
curl -X POST "https://api.linkedin.com/v2/shares" \
  -H "Authorization: Bearer $LINKEDIN_TOKEN" \
  -d '{
    "owner": "urn:li:person:xxx",
    "subject": {
      "title": "Post Title"
    },
    "text": {
      "text": "Post content..."
    }
  }'
```

### `instagram` — Instagram Content
```bash
# Generate caption
node scripts/generate-instagram.js \
  --image content/post-image.png \
  --topic "Team retreat" \
  --tone "casual" \
  --hashtags 10 \
  --output content/instagram-caption.md

# Post to Instagram (via Graph API)
curl -X POST "https://graph.instagram.com/me/media" \
  -F "image_url=https://agencyos.network/image.jpg" \
  -F "caption=Caption text..." \
  -F "access_token=$INSTAGRAM_TOKEN"
```

## Hashtag Strategy

### Research Hashtags
```bash
# Find trending hashtags
curl -s "https://api.hashtagify.me/v1/hashtag/trends" \
  -H "apiKey: $HASHTAGIFY_KEY"

# Analyze hashtag performance
curl -s "https://api.hashtagify.me/v1/hashtag/automation" \
  -H "apiKey: $HASHTAGIFY_KEY" \
  | jq '{popularity: .popularity, trend: .trend}'
```

### Hashtag Sets by Topic
```yaml
# AI/Tech
AI: ['#AI', '#ArtificialIntelligence', '#MachineLearning', '#DeepLearning', '#Tech']
Automation: ['#Automation', '#RPA', '#Productivity', '#Efficiency', '#FutureOfWork']
SaaS: ['#SaaS', '#Cloud', '#Software', '#Startup', '#B2B']

# Business
Startup: ['#Startup', '#Entrepreneur', '#Business', '#Innovation', '#Growth']
Agency: ['#Agency', '#DigitalAgency', '#Marketing', '#Creative', '#Services']
```

## Content Calendar

```yaml
# Weekly posting schedule
schedule:
  monday:
    platform: linkedin
    type: thought-leadership
    time: "09:00"
  tuesday:
    platform: twitter
    type: thread
    time: "10:00"
  wednesday:
    platform: instagram
    type: behind-the-scenes
    time: "11:30"
  thursday:
    platform: linkedin
    type: case-study
    time: "08:30"
  friday:
    platform: twitter
    type: weekly-roundup
    time: "14:00"
```

## Engagement Tactics

```markdown
## Twitter Engagement Boosters
- Ask questions: "What's your take on...?"
- Use polls: "Which do you prefer: A or B?"
- Tag relevant accounts: "@elonmusk thoughts?"
- Thread hooks: "🧵 Here's what nobody tells you..."
- Controversial takes: "Hot take: [unpopular opinion]"

## LinkedIn Engagement Boosters
- Personal stories: "Here's what I learned..."
- Data-driven posts: "We analyzed 1,000 customers..."
- Behind-the-scenes: "Sneak peek at our..."
- Ask for advice: "Looking for feedback on..."
- Celebrate wins: "Thrilled to announce..."
```

## Analytics Tracking

```bash
# Track engagement
node scripts/track-social.js \
  --platform twitter \
  --date-from "2026-02-01" \
  --date-to "2026-03-04" \
  --output reports/social-analytics.json

# Metrics to track
metrics:
  - impressions
  - engagements
  - engagement_rate
  - clicks
  - shares
  - comments
  - follows
```

## Related Commands

- `/blog-post` — Blog content
- `/email-campaign` — Email marketing
- `/landing-page` — Landing page copy
