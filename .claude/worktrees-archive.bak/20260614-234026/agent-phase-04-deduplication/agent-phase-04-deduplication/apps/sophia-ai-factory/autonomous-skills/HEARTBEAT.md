# Sophia AI Factory - Autonomous Heartbeat

24/7 autonomous operation checklist for CHÚA CHÙM agents.

## Every 4 Hours

- [ ] **Affiliate Scout**: Scrape Impact Radius, PartnerStack, CJ Affiliate
- [ ] Filter by: Fintech/Crypto/SaaS, EPC > $5, Commission > $50
- [ ] Save to Airtable Affiliates table
- [ ] Auto-assign tier: BASIC/PREMIUM/ENTERPRISE
- [ ] Send Slack alert for high-EPC programs (> $20)

## Daily at 6:00 UTC

- [ ] **Content Producer**: Generate AI video from script to final render
- [ ] Stage 1: OpenRouter (Claude) - Generate 60-90s script with hook scoring
- [ ] Stage 2: ElevenLabs - Synthesize Vietnamese female voice
- [ ] Stage 3: D-ID - Create AI avatar video with stock footage B-roll
- [ ] Quality gates: Hook ≥70, 100-250 words, 50-110s duration
- [ ] Save to Airtable Scripts & Videos tables
- [ ] Upload to Cloudflare R2 with CDN

## Event-Driven (when video_ready)

- [ ] **Auto Publisher**: Publish to YouTube, TikTok, Instagram
- [ ] Stage 1: OpenRouter (Claude) - Generate platform-optimized metadata
- [ ] Stage 2: YouTube API - Upload landscape video (1920x1080)
- [ ] Stage 3: TikTok API - Upload portrait video (1080x1920)
- [ ] Stage 4: Instagram API - Upload Reels (1080x1080)
- [ ] Stage 5: Setup analytics tracking with UTM links
- [ ] Wait 24h then collect performance metrics
- [ ] Send Telegram report with views/engagement

## Health Checks (Every 5 Minutes)

- [ ] Airtable API - Verify connection (200 OK)
- [ ] OpenRouter API - Check model availability
- [ ] ElevenLabs API - Verify quota remaining
- [ ] Cloudflare R2 - Check storage capacity
- [ ] YouTube API - Verify quota (10,000 units/day)

## Cost Monitoring (Continuous)

- [ ] Track daily spend: Target < $100/day
- [ ] Track monthly spend: Target < $3,000/month
- [ ] Alert at 80% budget threshold (warning)
- [ ] Alert at 95% budget threshold (critical)
- [ ] Auto-pause at 100% budget threshold

## Error Recovery (As Needed)

- [ ] Retry failed operations (max 3 attempts, exponential backoff)
- [ ] Switch to fallback services (Pictory for video, backup voice for ElevenLabs)
- [ ] Alert admin on consecutive failures (5 in a row)
- [ ] Pause skill on critical errors
- [ ] Log all errors to Airtable Activity table

## Weekly Optimization (Sundays at 2:00 UTC)

- [ ] Analyze top-performing topics
- [ ] Identify best publishing times per platform
- [ ] Review highest-converting affiliates
- [ ] Optimize content-producer settings
- [ ] Update affiliate-scout filters
- [ ] Generate weekly performance report

## Monthly Maintenance (1st of month at 3:00 UTC)

- [ ] Database optimization (Airtable)
- [ ] Log cleanup (retain 90 days)
- [ ] Quota reset verification
- [ ] Cost report generation
- [ ] Backup configuration to GitHub
- [ ] API key rotation check (every 90 days)

## Notifications

- [ ] **Telegram**: Real-time alerts to admin chat
- [ ] **Slack**: #sophia-ai-alerts channel
- [ ] **Email**: Daily digest at 9:00 Asia/Ho_Chi_Minh
- [ ] **Email**: Weekly summary every Monday

## Compliance Checks

- [ ] Affiliate disclosure in all video descriptions
- [ ] No medical claims in scripts
- [ ] No get-rich-quick promises
- [ ] Follow YouTube Community Guidelines
- [ ] Follow TikTok Content Policy
- [ ] Follow Instagram Terms of Service
- [ ] Respect robots.txt for all scrapers
- [ ] Rate limiting: 60 requests/minute max
