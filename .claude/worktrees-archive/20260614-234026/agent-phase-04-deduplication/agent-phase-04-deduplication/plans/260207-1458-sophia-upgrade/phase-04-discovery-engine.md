# Phase 04: Discovery Engine

## Context Links

- [Main Plan](./plan.md)
- [Phase 3: Polar.sh Payments](./phase-03-polar-payments.md)
- [NewsAPI Docs](https://newsapi.org/docs)
- [Reddit API](https://www.reddit.com/dev/api)
- [Twitter/X API](https://developer.twitter.com/en/docs)

## Overview

**Priority**: P1 (Critical)
**Status**: Pending
**Description**: Build AI-powered trend discovery engine that aggregates data from News/Social APIs, detects emerging trends using AI analysis, and stores results for campaign generation.

## Key Insights

- **Multi-Source Aggregation**: NewsAPI + Reddit + Twitter/X for comprehensive coverage
- **AI-Powered Analysis**: GPT-4 analyzes content to identify emerging trends
- **Rate Limit Management**: All APIs have strict rate limits, need caching strategy
- **Real-Time vs Batch**: Real-time for user requests, batch for daily digest
- **Trend Scoring**: Combine engagement metrics + AI sentiment + velocity
- **Storage Strategy**: Postgres for trends, Redis for API response cache

## Requirements

### Functional Requirements
- API integration with NewsAPI, Reddit, Twitter/X
- Trend detection algorithm (AI-powered)
- User-defined filters (niche, region, timeframe)
- Trend scoring system (relevance, engagement, velocity)
- Daily batch processing for trending topics
- Real-time discovery on user command
- API response caching (reduce costs)
- Trend expiry logic (auto-archive old trends)

### Non-Functional Requirements
- API aggregation time < 5s for user requests
- Batch processing completes in < 10 minutes
- Handle 100 concurrent discovery requests
- Cache hit rate > 80% (reduce API calls)
- Store 1000+ trends per day
- Trend retrieval < 200ms

## Architecture

```
src/
├── lib/
│   ├── discovery/
│   │   ├── api-clients/
│   │   │   ├── news-api-client.ts          # NewsAPI integration
│   │   │   ├── reddit-api-client.ts        # Reddit integration
│   │   │   ├── twitter-api-client.ts       # Twitter/X integration
│   │   │   └── api-rate-limiter.ts         # Rate limit management
│   │   ├── analyzers/
│   │   │   ├── trend-detector.ts           # AI-powered analysis
│   │   │   ├── sentiment-analyzer.ts       # Sentiment scoring
│   │   │   └── trend-scorer.ts             # Scoring algorithm
│   │   ├── processors/
│   │   │   ├── batch-processor.ts          # Daily digest job
│   │   │   ├── realtime-processor.ts       # User-triggered discovery
│   │   │   └── trend-aggregator.ts         # Multi-source merge
│   │   └── services/
│   │       ├── trend-storage-service.ts    # DB operations
│   │       └── cache-service.ts            # Redis caching
│   └── ai/
│       └── openai-client.ts                # GPT-4 integration
└── app/api/
    ├── discovery/
    │   ├── search/route.ts                 # User discovery endpoint
    │   └── top-50/route.ts                 # Daily top trends
    └── cron/
        └── discover-trends/route.ts        # Vercel Cron job

Database Schema (Supabase):
trends
├── id (uuid, PK)
├── title (text)
├── description (text)
├── source (enum: news, reddit, twitter)
├── url (text)
├── niche (text)
├── region (text)
├── score (numeric)              # Composite score
├── engagement_count (int)       # Likes/upvotes/shares
├── sentiment (numeric -1 to 1)  # AI sentiment analysis
├── velocity (numeric)           # Growth rate
├── keywords (text[])
├── discovered_at (timestamp)
├── expires_at (timestamp)       # Auto-archive after 7 days
├── created_at (timestamp)

discovery_cache (Redis)
├── key: "api:{source}:{query_hash}"
├── value: JSON response
├── TTL: 1 hour
```

**Data Flow**:
1. User sends `/discover` with filters (niche, region, timeframe)
2. Bot calls `/api/discovery/search?niche=X&region=Y`
3. Discovery engine checks Redis cache
4. If miss: Fetch from NewsAPI + Reddit + Twitter (parallel)
5. AI analyzer detects trends using GPT-4
6. Trend scorer calculates composite score
7. Store results in `trends` table
8. Cache API responses in Redis
9. Return top 10 trends to user

**Batch Processing Flow** (Vercel Cron):
1. Daily at 6 AM UTC: Trigger `/api/cron/discover-trends`
2. Fetch top stories from all sources
3. AI analysis on 100+ articles
4. Store top 50 trends in DB
5. Send digest to subscribed users via Telegram

## Related Code Files

### Files to Create
- `src/lib/discovery/api-clients/news-api-client.ts` - NewsAPI integration
- `src/lib/discovery/api-clients/reddit-api-client.ts` - Reddit integration
- `src/lib/discovery/api-clients/twitter-api-client.ts` - Twitter/X integration
- `src/lib/discovery/api-clients/api-rate-limiter.ts` - Rate limit manager
- `src/lib/discovery/analyzers/trend-detector.ts` - AI trend detection
- `src/lib/discovery/analyzers/sentiment-analyzer.ts` - Sentiment analysis
- `src/lib/discovery/analyzers/trend-scorer.ts` - Scoring algorithm
- `src/lib/discovery/processors/batch-processor.ts` - Daily digest
- `src/lib/discovery/processors/realtime-processor.ts` - User requests
- `src/lib/discovery/processors/trend-aggregator.ts` - Multi-source merge
- `src/lib/discovery/services/trend-storage-service.ts` - DB operations
- `src/lib/discovery/services/cache-service.ts` - Redis caching
- `src/lib/ai/openai-client.ts` - GPT-4 integration
- `src/app/api/discovery/search/route.ts` - User discovery endpoint
- `src/app/api/discovery/top-50/route.ts` - Daily top trends
- `src/app/api/cron/discover-trends/route.ts` - Vercel Cron job
- `supabase/migrations/004_trends_table.sql` - Schema migration

### Files to Modify
- `src/bot/commands/discover-command-handler.ts` - Call discovery API
- `.env.example` - Add API keys (NewsAPI, Reddit, Twitter, OpenAI)

## Implementation Steps

1. **Create Database Schema**
   ```sql
   -- supabase/migrations/004_trends_table.sql
   CREATE TABLE trends (
     id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
     title TEXT NOT NULL,
     description TEXT,
     source TEXT CHECK (source IN ('news', 'reddit', 'twitter')),
     url TEXT,
     niche TEXT,
     region TEXT,
     score NUMERIC NOT NULL DEFAULT 0,
     engagement_count INT DEFAULT 0,
     sentiment NUMERIC CHECK (sentiment >= -1 AND sentiment <= 1),
     velocity NUMERIC DEFAULT 0,
     keywords TEXT[],
     discovered_at TIMESTAMPTZ DEFAULT NOW(),
     expires_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '7 days',
     created_at TIMESTAMPTZ DEFAULT NOW()
   );

   CREATE INDEX idx_trends_score ON trends(score DESC);
   CREATE INDEX idx_trends_niche ON trends(niche);
   CREATE INDEX idx_trends_region ON trends(region);
   CREATE INDEX idx_trends_expires_at ON trends(expires_at);
   ```

2. **Build API Clients**

   **NewsAPI Client**:
   ```typescript
   // src/lib/discovery/api-clients/news-api-client.ts
   export async function fetchTopHeadlines(query: string, country?: string) {
     const url = `https://newsapi.org/v2/everything?q=${query}&apiKey=${NEWSAPI_KEY}`;
     const response = await fetch(url);
     return response.json();
   }
   ```

   **Reddit Client**:
   ```typescript
   // src/lib/discovery/api-clients/reddit-api-client.ts
   export async function fetchHotPosts(subreddit: string, limit = 25) {
     const url = `https://www.reddit.com/r/${subreddit}/hot.json?limit=${limit}`;
     const response = await fetch(url);
     return response.json();
   }
   ```

   **Twitter Client**:
   ```typescript
   // src/lib/discovery/api-clients/twitter-api-client.ts
   export async function searchTweets(query: string, maxResults = 100) {
     const url = `https://api.twitter.com/2/tweets/search/recent?query=${query}`;
     const response = await fetch(url, {
       headers: { Authorization: `Bearer ${TWITTER_BEARER_TOKEN}` }
     });
     return response.json();
   }
   ```

3. **Build Rate Limiter**
   - Create `src/lib/discovery/api-clients/api-rate-limiter.ts`
   - Token bucket algorithm:
     - NewsAPI: 100 requests/day
     - Reddit: 60 requests/minute
     - Twitter: 300 requests/15 minutes
   - Store tokens in Redis: `rate_limit:{source}:{timestamp}`

4. **Build Trend Detector (AI-Powered)**
   - Create `src/lib/discovery/analyzers/trend-detector.ts`
   - Use GPT-4 to analyze content:
     ```typescript
     const prompt = `Analyze these articles and identify emerging trends:
     ${articles.map(a => a.title + '\n' + a.description).join('\n\n')}

     Return a JSON array of trends with:
     - title
     - description
     - keywords (array)
     - sentiment (-1 to 1)
     `;

     const response = await openai.chat.completions.create({
       model: 'gpt-4',
       messages: [{ role: 'user', content: prompt }]
     });
     ```

5. **Build Trend Scorer**
   - Create `src/lib/discovery/analyzers/trend-scorer.ts`
   - Scoring formula:
     ```typescript
     score = (
       engagement_count * 0.4 +
       sentiment * 20 +        // Positive sentiment bonus
       velocity * 0.3 +        // Growth rate
       freshness * 0.3         // Recency bonus
     )
     ```
   - Normalize to 0-100 scale

6. **Build Sentiment Analyzer**
   - Create `src/lib/discovery/analyzers/sentiment-analyzer.ts`
   - Use GPT-4 or simple lexicon-based approach
   - Return score: -1 (negative) to +1 (positive)

7. **Build Trend Aggregator**
   - Create `src/lib/discovery/processors/trend-aggregator.ts`
   - Fetch from all sources in parallel
   - Merge results, deduplicate by URL
   - Sort by score (descending)

8. **Build Cache Service**
   - Create `src/lib/discovery/services/cache-service.ts`
   - Methods:
     - `getCached(source, query)`: Check Redis cache
     - `setCached(source, query, data)`: Store with 1h TTL
     - `invalidateCache(source)`: Clear all cached data

9. **Build Real-Time Processor**
   - Create `src/lib/discovery/processors/realtime-processor.ts`
   - Handle user-triggered discovery requests
   - Steps:
     1. Check cache
     2. If miss: Fetch from APIs (parallel)
     3. AI analysis
     4. Store in DB
     5. Cache results
     6. Return top 10 trends

10. **Build Batch Processor**
    - Create `src/lib/discovery/processors/batch-processor.ts`
    - Daily digest job:
      1. Fetch top 100 stories from each source
      2. AI analysis on all content
      3. Score and rank trends
      4. Store top 50 in DB
      5. Send digest to subscribed users

11. **Create API Endpoints**

    **Search Endpoint**:
    ```typescript
    // src/app/api/discovery/search/route.ts
    export async function GET(request: Request) {
      const { searchParams } = new URL(request.url);
      const niche = searchParams.get('niche');
      const region = searchParams.get('region');

      const trends = await realtimeProcessor.discover({ niche, region });
      return Response.json({ trends });
    }
    ```

    **Top 50 Endpoint**:
    ```typescript
    // src/app/api/discovery/top-50/route.ts
    export async function GET() {
      const trends = await supabase
        .from('trends')
        .select('*')
        .order('score', { ascending: false })
        .limit(50);

      return Response.json({ trends: trends.data });
    }
    ```

12. **Create Vercel Cron Job**
    ```typescript
    // src/app/api/cron/discover-trends/route.ts
    export async function GET() {
      await batchProcessor.processDaily();
      return Response.json({ success: true });
    }
    ```

    Add to `vercel.json`:
    ```json
    {
      "crons": [{
        "path": "/api/cron/discover-trends",
        "schedule": "0 6 * * *"
      }]
    }
    ```

13. **Update Discover Command**
    - Modify `src/bot/commands/discover-command-handler.ts`
    - Show filter options (niche, region, timeframe)
    - Call `/api/discovery/search` with filters
    - Display top 10 trends in Telegram

14. **Test Discovery Flow**
    - Test real-time discovery with different filters
    - Test batch processing job (manual trigger)
    - Verify AI analysis quality
    - Verify scoring algorithm
    - Test cache hit rate (target: >80%)

## Todo List

- [ ] Create `trends` table migration
- [ ] Run migration on Supabase
- [ ] Build NewsAPI client
- [ ] Build Reddit API client
- [ ] Build Twitter/X API client
- [ ] Build rate limiter with token bucket algorithm
- [ ] Build trend detector with GPT-4 integration
- [ ] Build sentiment analyzer
- [ ] Build trend scorer with composite formula
- [ ] Build trend aggregator (multi-source merge)
- [ ] Build cache service (Redis)
- [ ] Build real-time processor
- [ ] Build batch processor for daily digest
- [ ] Create `/api/discovery/search` endpoint
- [ ] Create `/api/discovery/top-50` endpoint
- [ ] Create Vercel Cron job for batch processing
- [ ] Add Cron config to `vercel.json`
- [ ] Update `/discover` command to call API
- [ ] Test real-time discovery with filters
- [ ] Test batch processing job
- [ ] Verify AI analysis quality (manual review)
- [ ] Verify cache hit rate > 80%
- [ ] Monitor API rate limits

## Success Criteria

- [x] Discovery engine returns results in < 5s
- [x] Batch processing completes in < 10 minutes
- [x] AI analysis identifies relevant trends (manual review)
- [x] Trend scoring ranks results correctly
- [x] Cache hit rate > 80% (reduce API costs)
- [x] Rate limiter prevents API quota exceeded errors
- [x] Top 50 endpoint returns daily digest
- [x] `/discover` command shows filtered trends
- [x] Trends auto-expire after 7 days
- [x] All API responses cached in Redis
- [x] Batch job runs successfully on Vercel Cron

## Risk Assessment

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| API rate limits exceeded | High | High | Implement caching, batch processing, rate limiter |
| NewsAPI quota exhausted | Medium | Medium | Cache aggressively, use free tier limits wisely |
| Twitter API changes (X rebranding) | High | Low | Monitor API docs, have fallback sources |
| AI analysis quality issues | Medium | Medium | Fine-tune prompts, manual review sample results |
| Batch job timeout (Vercel 10min limit) | Low | Medium | Optimize processing, split into smaller jobs |
| Trend deduplication failures | Medium | Low | Use URL as unique key, fuzzy matching for titles |

## Security Considerations

- **API Keys**: Store in Vercel env vars, NEVER commit to git
- **Rate Limiting**: Per-user limits on `/api/discovery/search` (10 req/hour)
- **Input Validation**: Sanitize user filters (niche, region)
- **Cache Poisoning**: Validate API responses before caching
- **AI Prompt Injection**: Sanitize article content before GPT-4 analysis
- **Cost Control**: Monitor OpenAI API usage, set spending limits

## Next Steps

After Phase 4 completion:
1. Proceed to [Phase 5: Campaign Templates](./phase-05-campaign-templates.md)
2. Test discovery engine with real users
3. Monitor API costs (NewsAPI, Reddit, Twitter, OpenAI)
4. Fine-tune scoring algorithm based on user feedback
5. Set up alerts for API quota exceeded errors
