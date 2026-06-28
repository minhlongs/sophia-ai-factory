---
name: affiliate-scout
description: Autonomous affiliate network scraper that discovers high-EPC programs every 4 hours
version: 1.0.0
tier_requirement: PREMIUM
metadata:
  openclaw:
    schedule: every_4_hours
    retry_on_failure: true
    max_retries: 3
    resources:
      memory_limit: 512mb
      timeout: 1800
---

# Affiliate Scout - Autonomous Network Scraper

Runs every 4 hours to discover high-EPC affiliate programs. Filters for Fintech, Crypto, SaaS with EPC > $5. Saves to Airtable Affiliates table.

## Data Sources

### Impact Radius
- **URL**: https://app.impact.com/secure/nosearch.ihtml
- **Auth**: API key
- **Filters**:
  - Categories: fintech, crypto, blockchain, defi
  - Min EPC: $5.00
  - Min Commission: $50
  - Cookie Duration: 30+ days

### PartnerStack
- **URL**: https://www.partnerstack.com/programs
- **Auth**: OAuth
- **Filters**:
  - Categories: saas, fintech, crypto
  - Min EPC: $5.00
  - Recurring: true

### CJ Affiliate
- **URL**: https://members.cj.com
- **Auth**: API key
- **Filters**:
  - Categories: financial_services, cryptocurrency, investment_platforms
  - Min EPC: $5.00
  - Min Commission: $100

## Extraction Rules

Extract the following fields from each source:

- **Program Name**: `.program-name, .offer-title` (required)
- **Commission Rate**: `.commission, .payout` → parse as percentage (required)
- **EPC**: `.epc, .earnings-per-click` → parse as number (required)
- **Cookie Duration**: `.cookie, .tracking-duration` → parse as days (required)
- **Description**: `.description, .program-details` (max 500 chars)
- **Affiliate Link**: `a.join-program, .apply-link` → href attribute (required)

## Quality Filters

Apply these filters to all discovered programs:

- Min EPC: $5.00
- Min Commission: $50
- Cookie Duration: 30+ days
- Exclude gambling: true
- Exclude adult content: true
- Require HTTPS: true
- Vietnam market friendly:
  - Accepts international traffic
  - No geo-restrictions
  - Supports USD payouts

## Airtable Integration

Save to Airtable `Affiliates` table with these field mappings:

- `name` → Name (single line text)
- `category` → Category (single select)
- `commission` → Commission (number)
- `commissionType` → Commission Type (single select: recurring/one-time/hybrid)
- `epc` → EPC (number)
- `cookieDuration` → Cookie Duration (number)
- `description` → Description (long text)
- `link` → Affiliate Link (URL)
- `tags` → Tags (multi-select)
- `tier` → Tier (single select: BASIC/PREMIUM/ENTERPRISE)
- `source` → Source (single select: impact_radius/partnerstack/cj_affiliate)
- `scrapedAt` → Last Scraped (date)
- `status` → Status (single select: active/pending/rejected)

### Deduplication Strategy

- **Unique Key**: `affiliate_link`
- **On Duplicate**: Update if new EPC is better

### Auto-Tier Assignment

```
IF epc >= 10 AND commission >= 100 THEN tier = ENTERPRISE
ELSE IF epc >= 5 AND commission >= 50 THEN tier = PREMIUM
ELSE tier = BASIC
```

## Notifications

### Slack
- **Channel**: #affiliate-alerts
- **On New Program**: true
- **On High EPC** (> $20):
  ```
  🔥 HIGH EPC ALERT: {name} - ${epc} EPC
  ```

### Email
- **To**: admin@sophiaai.com
- **Daily Summary**: true
- **Summary Time**: 09:00 UTC

## Error Handling

### Network Error
- **Action**: Retry
- **Max Retries**: 3
- **Backoff**: Exponential

### Auth Failure
- **Action**: Alert admin
- **Pause Scraping**: true

### Rate Limit
- **Action**: Wait and retry
- **Wait Time**: 3600 seconds (1 hour)

## Logging

Log to multiple destinations:

1. **Airtable Activity Table**:
   - type: "affiliate_scout"
   - status: "{status}"
   - programs_found: "{count}"
   - timestamp: "{timestamp}"

2. **File**: `logs/affiliate-scout.log`

3. **CloudWatch** (if AWS):
   - Group: `/sophia-ai/affiliate-scout`
   - Stream: `{date}`

## Performance Metrics

Track these metrics:

- programs_discovered
- programs_saved
- duplicate_count
- avg_epc
- scraping_duration
- error_rate

**Dashboard**: `/admin/metrics/affiliate-scout`

## Compliance

- **Respect robots.txt**: true
- **Rate Limiting**:
  - Requests per minute: 60
  - Concurrent requests: 5
- **Data Retention**: Remove inactive programs after 90 days
- **GDPR Compliance**: Store program metadata only, no personal data
