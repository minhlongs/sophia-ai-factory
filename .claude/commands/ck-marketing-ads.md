# Marketing Ads - Paid Advertising Bundle

> **Binh Pháp Ch.2 作戰 (Waging War):** "Binh quý thần tốc - Speed is essence of war"

## Skills Activated

- `paid-ads` - Ad strategy & copy
- `ab-test-setup` - Testing framework
- `analytics-tracking` - ROI tracking

## Tools Integrated

- Google Ads (via MCP)
- Meta Ads (Facebook/Instagram)
- LinkedIn Ads
- TikTok Ads

## Syntax

```bash
/marketing-ads strategy [platform] [budget]    # Full strategy
/marketing-ads copy [platform] --product="..." # Ad copy
/marketing-ads track --pixel=[platform]        # Tracking setup
/marketing-ads ab-test --campaign="..."        # A/B testing
```

## When to Use

- Launch paid campaign
- Optimize existing ads
- Setup conversion tracking
- A/B test ad creatives

## Ad Strategy Framework

### 1. Campaign Structure

```
Account
└── Campaign (objective)
    └── Ad Set (audience)
        └── Ad (creative)
```

### 2. Audience Targeting

```markdown
## Facebook/Instagram

- Custom Audiences (website, email, engagement)
- Lookalike Audiences (1%, 3%, 5%)
- Interest/Behavior targeting
- Retargeting segments

## Google

- Search intent keywords
- Remarketing lists (RLSA)
- In-market audiences
- Custom intent audiences
```

### 3. Budget Allocation

```markdown
## Testing Phase (Week 1-2)

- 60% Prospecting
- 40% Retargeting

## Scaling Phase (Week 3+)

- 40% Prospecting
- 40% Retargeting
- 20% Top performers
```

## Ad Copy Templates

### Facebook Primary Text

```
Hook: [Pain point question or surprising statement]

Agitate: [Expand on the problem]

Solution: [How you solve it]

Proof: [Social proof or result]

CTA: [Clear call to action]
```

### Google Search Ads

```
Headline 1: [Keyword + Benefit]
Headline 2: [Unique Value Prop]
Headline 3: [CTA or Offer]
Description 1: [Expand benefit, address objection]
Description 2: [Social proof + CTA]
```

### Vietnamese Ad Templates

```
🔥 [Headline hook]

✅ [Benefit 1]
✅ [Benefit 2]
✅ [Benefit 3]

🎁 [Offer/Promotion]

👉 [CTA] ngay hôm nay!
📞 Hotline: [phone]
```

## Tracking Setup

```bash
# Facebook Pixel
/marketing-ads track --pixel=facebook --events="PageView,Purchase,Lead"

# Google Tag Manager
/marketing-ads track --gtm --conversions="purchase,signup"

# UTM Parameters
/marketing-ads track --utm --campaign="launch_jan"
```

## A/B Testing Framework

```markdown
## Test Priority

1. Offer/Hook (highest impact)
2. Creative (image/video)
3. Audience
4. Copy variations
5. CTA

## Sample Size Calculator

- Minimum 100 conversions per variant
- Run for 7-14 days minimum
- Statistical significance: 95%

## Test Documentation

| Test | Hypothesis | Control | Variant | Winner | Lift |
| ---- | ---------- | ------- | ------- | ------ | ---- |
```

## Platform-Specific Guides

### Facebook/Instagram

```bash
/marketing-ads copy facebook --objective=conversions --product="..."
```

- Image: 1080x1080 or 1080x1920
- Video: 15-30s, vertical preferred
- Caption: 125 chars visible

### Google Search

```bash
/marketing-ads copy google --keywords="cơm văn phòng Sa Đéc"
```

- Match types: Phrase, Exact
- Negative keywords list
- Ad extensions: Sitelinks, Callouts

### TikTok

```bash
/marketing-ads copy tiktok --style=ugc
```

- Vertical 9:16
- 15-60 seconds
- Hook in first 3 seconds
- Native, authentic feel

## Output Format

```markdown
## Campaign Strategy

- Objective: [conversion/awareness/traffic]
- Budget: [amount]/[day/month]
- Duration: [timeframe]
- Primary KPI: [CPA/ROAS/CPM]

## Audience Segments

| Segment | Size | Targeting | Priority |
| ------- | ---- | --------- | -------- |

## Ad Creatives

### Version A

- Hook: [text]
- Body: [text]
- CTA: [text]
- Visual: [description]

### Version B

[...same structure...]

## Tracking Plan

| Event | Platform | Trigger |
| ----- | -------- | ------- |

## Testing Plan

| Week | Test | Budget |
| ---- | ---- | ------ |
```

## Related Commands

- `/marketing-copy` - Ad copywriting
- `/marketing-cro` - Landing page optimization
- `/marketing-growth` - Organic tactics

## ĐIỀU 50

> Strategy → Launch → Optimize → Scale
> Thần tốc là chìa khóa!
