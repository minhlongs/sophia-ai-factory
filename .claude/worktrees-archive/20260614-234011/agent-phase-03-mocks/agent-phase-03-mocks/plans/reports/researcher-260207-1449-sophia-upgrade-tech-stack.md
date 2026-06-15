# Sophia AI Factory Upgrade - Technical Research Report

**Date:** 2026-02-07
**Researcher:** researcher (af000dc)
**Context:** Parallel research for Next.js 15 + React 19 + Polar.sh Telegram integration

---

## 1. Tech Stack Compatibility (Next.js 15 + React 19 + Tailwind v4 + Framer Motion)

### Next.js 15 + React 19 Status: ✅ Production Ready

**Key Breaking Changes:**
- **Async Request APIs** - `cookies()`, `headers()`, `draftMode()`, `params`, `searchParams` now require `async/await`
  - Migration codemod: `npx @next/codemod@canary next-async-request-api`
- **Caching Defaults Changed** - GET Route Handlers and Page components NO LONGER cached by default
- **Minimum React 19 RC required** - Pages Router retains React 18 backward compatibility
- **Image Optimization** - Squoosh replaced by Sharp (optional dependency)
- **Performance Gains** - 40% Core Web Vitals improvement, 60% Time to Interactive reduction

**Breaking Changes in React 19:**
- Error handling in rendering changed (errors no longer re-thrown)
- `propTypes` and `defaultProps` removed for function components
- Module pattern factories removed

**Recommendation:** Upgrade safe. Use codemods. Test caching behavior changes carefully.

**Sources:**
- [Next.js Official Docs](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQG27C-Qb9oFsBz052VgTWB_F3cf7VwIBkAEfvBeJ1p6M91MCn_8q1-SMUN2moMxqzxeLRl33yyH8tOkiU1R_6uKA1U0mg-w7j5O4KaNrNOQknDz2WovbNlMgw==)
- [Plain English Guide](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQEPd2kN3CKt6BP_GyUqnCb139QOe65ILjDIS9LAKsP58Y73friuljgdnk6WI7OnSbMabq1vTWG0-DYeORE5s-jchi3zAkuqxPX5jifYI2ATmUmEhuso-u8rZWqf5BuaVuu7E0Ed8qnXO2qiZv27oUAHPkGDPK9E8vg6ri6HzI5z1mEzrMnCOndZj8lrDzXJXZgQOT-_U8EOb84pyJlVdopqiRLVnhU=)

### Tailwind CSS v4 Status: ✅ Production Ready (Released Jan 2025)

- **First beta:** Nov 2024
- **Full release:** Jan 22, 2025 (v4.0)
- **Current version:** 4.1 (Apr 2025)
- **Status:** Stable for production use in 2026

**Recommendation:** Safe to use. No alpha/beta concerns.

**Sources:**
- [LogRocket Guide](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQHTJFQQJBqEbuq4eYK-kQfkF9T1zE8d253xGCzff5UkkWcwpiw3_Hx7o-tU3VH5zpku7FNbwX1GEWAGZh3MgY0cRLMGLnrRakO-Fnn1cCorGT1_RWVzpOr524L2fNszMaSsDu_eNhzuNQk=)
- [Dev.to Discussion](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQELfFIE0If7qZZ_1ro_gZsXYLgCFsGC5bgScIPfbdryILMkpqENy5uFc-z7YqWe2-O0gw1pDi9pi9enm-4ZIGgkB8p1oagjti1RolFEFNVXQ-fIdYm-OSM7JQkUntvN3oIWAhQziuk2-7eB-jCo2ECUF-3i0Q9MubNoGSdJ-L7_NqW6eg==)

### Framer Motion Status: ⚠️ Use Canary/Alpha for React 19

**Problem:** Stable Framer Motion built for React 18. React 19 breaking changes (`forwardRef` removal, type changes) prevent direct upgrade.

**Solution:**
```bash
npm install framer-motion@canary
# OR
npm install framer-motion@12.0.0-alpha.1
```

**Known Issues:**
- `className` prop errors with Next.js 15 + React 19 (workaround: custom tag wrapper)
- Dependency conflicts when upgrading Next.js 15
- React 18 types may persist in Next.js 15 even with React 19

**Recommendation:** Use canary/alpha builds. Test thoroughly. Consider alternatives (React Spring, Motion One) if stability critical.

**Sources:**
- [GitHub Issue #2565](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQHY9n2_GE22I2Dm-LJst4Q7QS35xq_0nWy7uwAVKbR3kLfc6F9IM5WtSGnTP7T53k9n6G51ZIKiGSKY6R__7_GtFb7IyaK2tRfC5wFR9kCndzZf_adzU1LKdxpWlQlM8Ch3ctHIq3NgJiiKGKv84r0=)
- [Reddit Discussion](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQEZaEHASXtcsGMCGqD6H83uX6zyrFLjj-NUaN4tiybMrSy-_fiLp_2_2Si9GdP7mr9OQ-PGg3T9XVIVG4qUlplzK1VnttxWivo0FE5179LXEQTe_t2oZuhcCpWDUFm73rc41rXN__mbDz--ORsuBQ3Ds4XmMMSJcMcdT2W1MIc92so7-LpuTJdt9COlZkha296wYuiVMzXrLYCuni0e_4M=)

---

## 2. Polar.sh for Telegram - Subscription Gating

### Architecture Pattern: Webhook-Driven Verification

**Polar.sh provides:**
- Webhook events for real-time subscription state changes
- API endpoints for on-demand subscription verification
- Standard Webhooks format (JSON payload + signature verification)

### Implementation Strategy

#### Step 1: Configure Polar.sh Webhooks
```yaml
webhook_url: https://your-bot-backend.com/polar-webhook
events:
  - subscription.created
  - subscription.updated
  - subscription.canceled
  - checkout.session.completed
format: Raw (JSON)
secret: <generate_in_polar_dashboard>
```

#### Step 2: Backend Service (Node.js/Python/Go)
```javascript
// Webhook handler pseudocode
app.post('/polar-webhook', async (req, res) => {
  // 1. Verify signature using Polar SDK
  const isValid = polar.verifyWebhook(req.body, req.headers['signature'], SECRET);
  if (!isValid) return res.status(401).send('Invalid signature');

  // 2. Parse event
  const { type, data } = req.body;
  const { user_id, subscription_status, product_id } = data;

  // 3. Update database (Postgres/Redis)
  await db.updateSubscription(user_id, subscription_status);

  // 4. Trigger Telegram Bot action
  if (type === 'subscription.created') {
    await telegramBot.sendMessage(user_id, 'Welcome! Your subscription is active.');
  } else if (type === 'subscription.canceled') {
    await telegramBot.sendMessage(user_id, 'Subscription canceled. Access revoked.');
  }

  res.status(200).send('OK');
});
```

#### Step 3: Telegram Bot Gating Logic
```javascript
// Before granting access to premium features
bot.on('message', async (msg) => {
  const chatId = msg.chat.id;

  // Check subscription status (cached in Redis or query Postgres)
  const subscription = await getSubscriptionStatus(chatId);

  if (!subscription || subscription.status !== 'active') {
    return bot.sendMessage(chatId, 'Subscribe to access this feature: [link]');
  }

  // Grant access to premium content
  await deliverPremiumContent(chatId);
});
```

### Key Events for Subscription Verification

| Event | Use Case |
|-------|----------|
| `checkout.session.completed` | Payment success, pre-subscription confirmation |
| `subscription.created` | Grant access, send welcome message |
| `subscription.updated` | Update access level (plan upgrade/downgrade) |
| `subscription.canceled` | Revoke access, send cancellation notice |

**Recommendation:** Use webhook-driven real-time updates + Redis caching for instant gating checks. Fallback to Polar API for missed webhooks.

**Sources:**
- [Polar.sh Webhooks Docs](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQEZYxAiYYIzAA56OGBgZdahE_T-qV-zLwruKNgTYhoSR1dGWRQz2DSn6MRpUAh696OVKuK8QY6s2HGxXHGeOtQLg6smvk7znK_ATaS5k1mK_ChyhCmntm-a0nmWsFmN2yBl6cSPR_RUNYMzpZiX)
- [Polar.sh Standard Webhooks](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQEF9ZWeSij6a2GtxUlNdsYeOBW_66WqrPULFkGk58idY3C40sHPwGdlxij6Jg7WRxqf_Peuv2I0d5wg2ck8Yd1O1KFl5qdASv50Tod2ODMZ4CANPsH30zm-bwohyQx-gg==)

---

## 3. Auto-Discovery Engine - Content Trend Architecture

### 2026 AI-Native Architecture Patterns

**Core Components:**
1. **AI-Driven Web Scraping** (cloud-native, compliance-aware)
2. **API Aggregation Layer** (GraphQL for flexibility, gRPC for performance)
3. **ML-Powered Trend Analysis** (predictive routing, anomaly detection)
4. **Cloud-Native Automation** (serverless orchestration)

### Recommended Stack

```yaml
scraping_layer:
  - real_browsers: Playwright/Puppeteer (managed infra)
  - ai_extraction: LLM-based content parsing (GPT-4/Claude)
  - anti_bot_bypass: Residential proxies + AI behavioral patterns

api_aggregation:
  - social_media: Twitter/X API, Reddit API, TikTok API
  - news_feeds: NewsAPI, RSS aggregators
  - video_platforms: YouTube Data API v3
  - trend_apis: Google Trends API, Exploding Topics API

processing:
  - trend_detection: Time-series analysis (Prophet/ARIMA)
  - sentiment_analysis: HuggingFace Transformers
  - ranking: ML models (collaborative filtering + content-based)

storage:
  - hot_data: Redis (trending now cache)
  - cold_data: Postgres (historical trends)
  - vector_db: Pinecone/Weaviate (semantic search)
```

### Architecture Diagram (Conceptual)

```
┌─────────────────────────────────────────────┐
│  Scraping Workers (Playwright + AI)         │
│  ├─ Twitter/X scraper                       │
│  ├─ Reddit scraper                          │
│  ├─ YouTube scraper                         │
│  └─ News aggregator                         │
└──────────────────┬──────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────┐
│  API Aggregation Layer (GraphQL Gateway)    │
│  ├─ Rate limiting per source                │
│  ├─ Data normalization                      │
│  └─ Caching (Redis)                         │
└──────────────────┬──────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────┐
│  AI Processing Pipeline                     │
│  ├─ Trend detection (ML models)             │
│  ├─ Sentiment scoring                       │
│  ├─ Duplicate removal (embeddings)          │
│  └─ Ranking algorithm                       │
└──────────────────┬──────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────┐
│  Storage Layer                              │
│  ├─ Postgres (trends, metadata)             │
│  ├─ Redis (hot cache, real-time scores)     │
│  └─ Vector DB (semantic search)             │
└──────────────────┬──────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────┐
│  Telegram Bot API (delivery)                │
└─────────────────────────────────────────────┘
```

### 2026 Best Practices
- **AI-first scraping**: Use LLMs to parse unstructured data instead of brittle CSS selectors
- **Compliance**: GDPR/CCPA-aware data collection, respect robots.txt
- **High-level APIs**: Favor managed scraping services (Bright Data, Apify) over DIY
- **Real-time processing**: Stream data directly to ML models via Kafka/RabbitMQ
- **API monetization**: Usage-based pricing for trend data access

**Recommendation:** Start with API aggregation (faster, more reliable). Add scraping only for sources without APIs. Use serverless functions (Vercel Edge, AWS Lambda) for cost efficiency.

**Sources:**
- [Browserless 2026 Scraping Trends](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQHqeKHML8A0_nst59vLlsxTdY9_ezbl_2xwSjvCC_r0ogSF5bD6_f4dPjvElaTAKmQbOaaE5R52TzJJpaoSwIzeK9OCoHcpWIcW8RAr1V5ie2qmyY_Q4sfRWjDNPkY-1HKLKJ2zI5adknmpn_dWN8t91kPy_GY=)
- [API Quality 2026 Predictions](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQFXZWc3_8yTFlchFkRwjI4tWygkSG3oukPyftY7BSjQg1C7ostnzV70LC9iocM3k2TWkx89PcqBMcm6sr2y4Qs48mj5jPO8Z7CJG06Wfz3eRoYTvCvE3WIdbQEdDgXLvZH1giJSRGad5gPudzA=)

---

## 4. Smart Resume - Telegram Bot Session State

### Hybrid Architecture: Redis + Postgres

**Pattern:** Redis for active sessions, Postgres for long-term persistence

### Implementation Design

#### Layer 1: Active Session Cache (Redis)
```javascript
// Session structure in Redis
{
  "chat_id:12345": {
    "state": "awaiting_trend_selection",
    "context": {
      "selected_category": "tech",
      "last_query": "AI trends",
      "page": 2
    },
    "timestamp": 1707318000,
    "ttl": 3600  // 1 hour inactivity timeout
  }
}
```

**Redis Usage:**
- Store current conversation state (FSM state machine)
- TTL for automatic cleanup (1-24 hours)
- Fast retrieval on every message (<1ms)

#### Layer 2: Long-Term Persistence (Postgres)
```sql
CREATE TABLE user_sessions (
  chat_id BIGINT PRIMARY KEY,
  conversation_state TEXT,
  context JSONB,
  last_active TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE conversation_history (
  id SERIAL PRIMARY KEY,
  chat_id BIGINT REFERENCES user_sessions(chat_id),
  message TEXT,
  timestamp TIMESTAMP DEFAULT NOW(),
  is_bot BOOLEAN
);
```

**Postgres Usage:**
- Backup session state every 5 minutes or on state change
- Store full conversation history
- Enable "resume from X days ago" feature

### Session Resume Flow

```javascript
bot.on('message', async (msg) => {
  const chatId = msg.chat.id;

  // 1. Check Redis for active session
  let session = await redis.get(`chat_id:${chatId}`);

  if (!session) {
    // 2. Fallback to Postgres
    const dbSession = await db.query(
      'SELECT * FROM user_sessions WHERE chat_id = $1',
      [chatId]
    );

    if (dbSession.rows.length > 0) {
      // 3. Restore session to Redis
      session = dbSession.rows[0];
      await redis.set(`chat_id:${chatId}`, JSON.stringify(session), 'EX', 3600);

      bot.sendMessage(chatId,
        `Welcome back! Resuming from: "${session.context.last_query}"`
      );
    } else {
      // 4. New session
      session = initNewSession(chatId);
    }
  }

  // 5. Process message with current state
  const nextState = await fsm.processMessage(session.state, msg.text);

  // 6. Update both Redis and Postgres
  await redis.set(`chat_id:${chatId}`, JSON.stringify(nextState), 'EX', 3600);
  await db.query(
    'INSERT INTO user_sessions (chat_id, conversation_state, context, last_active) VALUES ($1, $2, $3, NOW()) ON CONFLICT (chat_id) DO UPDATE SET conversation_state = $2, context = $3, last_active = NOW()',
    [chatId, nextState.state, JSON.stringify(nextState.context)]
  );
});
```

### State Machine (FSM) Pattern

```javascript
const conversationFSM = {
  states: {
    IDLE: {
      on: { START: 'SELECT_CATEGORY' }
    },
    SELECT_CATEGORY: {
      on: {
        CHOOSE: 'BROWSE_TRENDS',
        SEARCH: 'SEARCH_MODE'
      }
    },
    BROWSE_TRENDS: {
      on: {
        NEXT_PAGE: 'BROWSE_TRENDS',
        SELECT_TREND: 'VIEW_DETAILS',
        BACK: 'SELECT_CATEGORY'
      }
    },
    SEARCH_MODE: {
      on: {
        RESULTS: 'BROWSE_TRENDS',
        BACK: 'SELECT_CATEGORY'
      }
    },
    VIEW_DETAILS: {
      on: {
        BACK: 'BROWSE_TRENDS',
        SAVE: 'VIEW_DETAILS'
      }
    }
  }
};
```

### Best Practices (2026)

| Component | Tool | Purpose |
|-----------|------|---------|
| Redis | Upstash Redis (serverless) | Active session cache with TTL |
| Postgres | Supabase Postgres | Long-term persistence + RLS |
| FSM Library | `telegraf-session-redis` (Node.js) | Built-in Redis session support |
| State Management | `tg-state-manager` (Go) | Flexible storage adapters |
| Sync Strategy | Write-through cache | Redis + Postgres on every state change |

**Periodic Sync Pattern:**
```javascript
// Backup Redis to Postgres every 5 minutes
setInterval(async () => {
  const sessions = await redis.keys('chat_id:*');
  for (const key of sessions) {
    const session = JSON.parse(await redis.get(key));
    await syncToPostgres(session);
  }
}, 5 * 60 * 1000);
```

**Recommendation:** Use write-through caching (update both Redis + Postgres on every state change). Enables instant resume even after Redis flush or bot restart.

**Sources:**
- [Latenode Telegram State Guide](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQG9-6xUmSXWPBqwgeFtINRtynpklUC3bj7ESxYEfpsw1Ez6XhOJOEeWWX2DTBf45xQNvxlgYuJvJ6vLY0QCUbBTfhopiHAOlTB0os0ndWGXczSiSOl5qteQEvo8lorvJw7B1KksHpUdJ4sBgUcg9D-Mmf_anzd9CPaF2aUsJ6-YWcklkCb2UXXs51v-xg-N2YzG6brSYriU_Y5evean632pgw7kBI-3O30Uofqd)
- [GrammY Session Plugin](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQGEPuErDd3KQlhP4dx_mpuVGpMYD_38QB9fwuSfEVLlHTiLBi8eX7mGWGG-t0E-L43JEEdtINxhZc4n-JvAnbj27NGW-7r0Ff5-oqUiKaMRmTYQKNUXexG0nbNBGnk=)

---

## Summary Recommendations

### ✅ SAFE TO PROCEED
1. **Next.js 15 + React 19** - Use codemods, test caching changes
2. **Tailwind CSS v4** - Production ready
3. **Polar.sh Telegram** - Webhook-driven, proven pattern
4. **Redis + Postgres** - Industry standard for session state

### ⚠️ NEEDS ATTENTION
1. **Framer Motion** - Use `framer-motion@canary` or consider alternatives
2. **Auto-Discovery** - Start with API aggregation, add scraping incrementally

### 📋 TECH STACK FINAL
```yaml
frontend:
  framework: Next.js 15 (App Router)
  ui: React 19
  styling: Tailwind CSS v4
  animation: framer-motion@canary OR Motion One (stable alternative)

backend:
  runtime: Node.js 20+ (serverless edge functions)
  database: Supabase Postgres
  cache: Upstash Redis
  webhooks: Polar.sh Standard Webhooks

telegram_bot:
  library: Telegraf (Node.js) OR python-telegram-bot
  session: telegraf-session-redis
  state_machine: Custom FSM or Bot API built-in handlers

auto_discovery:
  phase_1: API aggregation (Twitter/Reddit/YouTube APIs)
  phase_2: AI scraping (Playwright + LLM parsing)
  processing: Serverless functions (Vercel Edge)
  storage: Redis (hot) + Postgres (cold) + Pinecone (semantic search)
```

### Unresolved Questions
1. Which specific social APIs to prioritize for discovery engine? (Twitter API v2 expensive, Reddit API rate limits)
2. Budget for managed scraping services (Bright Data, Apify) vs DIY?
3. Free tier limits for Upstash Redis vs self-hosted Redis on VPS?
4. Framer Motion canary stability timeline - when will stable React 19 support land?

---

**Report Path:** `/Users/macbookprom1/mekong-cli/apps/sophia-ai-factory/plans/reports/researcher-260207-1449-sophia-upgrade-tech-stack.md`
