# System Architecture / Kien Truc He Thong

> Sophia AI Video Factory — Zero Manual Content Production SaaS

**Last Updated / Cap Nhat:** 2026-02-09

---

## Component Diagram / So Do Thanh Phan

```
                           ┌──────────────────────────┐
                           │     Next.js App Router    │
                           │   (Vercel Edge/Serverless)│
                           └────────────┬─────────────┘
                                        │
        ┌───────────────┬───────────────┼───────────────┬───────────────┐
        │               │               │               │               │
   ┌────▼────┐    ┌─────▼─────┐   ┌─────▼─────┐  ┌─────▼─────┐  ┌─────▼─────┐
   │  Pages  │    │   API     │   │  Server   │  │ Middleware │  │   Auth    │
   │  (SSR)  │    │  Routes   │   │  Actions  │  │ (i18n+RLS)│  │ (Supabase)│
   └────┬────┘    └─────┬─────┘   └─────┬─────┘  └───────────┘  └───────────┘
        │               │               │
        └───────────────┼───────────────┘
                        │
        ┌───────────────┼───────────────────────────────┐
        │               │                               │
   ┌────▼────┐    ┌─────▼──────┐                  ┌─────▼──────┐
   │Supabase │    │  Inngest   │                  │  Telegram  │
   │Postgres │    │ (BG Jobs)  │                  │    Bot     │
   │+Auth    │    └─────┬──────┘                  │ (Webhooks) │
   │+Storage │          │                         └────────────┘
   └─────────┘    ┌─────┼──────────────┐
                  │     │              │
            ┌─────▼──┐ ┌▼──────────┐ ┌▼───────────────┐
            │generate│ │auto-disc  │ │ hello-world     │
            │campaign│ │affiliates │ │ (health check)  │
            └───┬────┘ └───────────┘ └─────────────────┘
                │
   ┌────────────┼──────────────────────────┐
   │            │                          │
   │  ┌────────▼────────┐   ┌─────────────▼─────────────┐
   │  │ Smart Resume     │   │   OpenClaw Gateway         │
   │  │ (Checkpoints)    │   │ (Multi-Channel Distribute) │
   │  └─────────────────┘   └─────────┬─────────────────┘
   │                            ┌─────┼──────┐
   │                            │     │      │
   │                       ┌────▼──┐ ┌▼───┐ ┌▼────────┐
   │                       │YouTube│ │Tik │ │Telegram  │
   │                       │Adapter│ │Tok │ │Notifier  │
   │                       └───────┘ └────┘ └──────────┘
   │
   │  AI Services Pipeline
   ├──> OpenRouter (Script Generation)
   ├──> ElevenLabs (Text-to-Speech)
   └──> HeyGen/D-ID (Video Generation)
```

---

## Data Flow / Luong Du Lieu

### Campaign Pipeline (Chien Dich)

```
User creates campaign (Dashboard or Telegram /campaign)
        │
        ▼
   ┌─────────────────────────────────────────────────┐
   │ Inngest: generate-campaign (event: campaign.created) │
   └───────┬─────────────────────────────────────────┘
           │
   Step 1: notify-start
           │  → Telegram notification to user
           ▼
   Step 2: generate-script
           │  → OpenRouter API → script JSON (scenes + narration)
           │  → Checkpoint saved
           ▼
   Step 3: generate-voiceover
           │  → ElevenLabs API → audio URL
           │  → Checkpoint saved
           ▼
   Step 4: start-video-generation
           │  → HeyGen/D-ID API → video job ID
           ▼
   Step 5: poll-video-status
           │  → Poll every 5s, max 60 attempts (5 min)
           │  → Returns video_url + thumbnail_url
           │  → Checkpoint saved
           ▼
   Step 6: distribute-channels (OpenClaw Gateway)
           │  → YouTube, TikTok, Telegram (parallel)
           │  → Self-heal on failure (retry failed channels)
           │  → Checkpoint saved
           ▼
   Step 7: finalize-campaign
           │  → Status: completed, progress: 100%
           │  → Telegram notification with video link
           │  → Clear all checkpoints
           ▼
        DONE
```

### Smart Resume (Khoi Phuc Tu Dong)

When a campaign fails mid-pipeline:
1. Last checkpoint is read from SmartResumeEngine
2. `resumeFrom` determines which step to skip to
3. Previously completed artifacts (script, audio, video) are fetched from Supabase
4. Pipeline resumes from the next uncompleted step

```
Failure at Step 4 (video gen timeout)
        │
        ▼
Resume event fired with resumeFrom="video"
        │
        ▼
Steps 1-3 skipped (artifacts loaded from DB)
        │
        ▼
Step 4 re-executed → continues normally
```

---

## Module Structure / Cau Truc Module

```
src/lib/
├── ai/                          # AI service integrations
│   ├── script-generator.ts      # OpenRouter script generation
│   ├── video-generator.ts       # HeyGen/D-ID video creation
│   └── text-to-speech-*.ts      # ElevenLabs TTS
│
├── gateway/                     # OpenClaw distribution gateway
│   ├── index.ts                 # Barrel exports
│   ├── gateway-types.ts         # Type definitions
│   ├── openclaw-gateway.ts      # Core gateway class
│   ├── smart-resume-engine.ts   # Checkpoint/resume engine
│   └── adapters/                # Channel adapters
│       ├── youtube-channel-adapter.ts
│       ├── tiktok-channel-adapter.ts
│       └── telegram-notification-adapter.ts
│
├── intelligence/                # SPS scoring engine
│   ├── types.ts                 # ScorableProduct, ScoreResult, ScoringConfig
│   ├── scoring.ts               # ScoringService (commission+popularity+reliability)
│   ├── normalization.ts         # Score normalization functions
│   └── runner.ts                # Batch scoring runner
│
├── discovery/                   # Affiliate discovery
│   └── affiliate-ai-scorer.ts   # Deterministic program scorer (no AI calls)
│
├── ingestion/                   # Product data ingestion
│   ├── types.ts                 # RawProduct, IngestionAdapter, NetworkId
│   ├── base-adapter.ts          # Base adapter pattern
│   ├── runner.ts                # Batch ingestion runner
│   └── adapters/
│       ├── clickbank-adapter.ts
│       └── shareasale-adapter.ts
│
├── inngest/                     # Background job definitions
│   ├── client.ts                # Inngest client singleton
│   └── functions/
│       ├── generate-campaign.ts       # Campaign pipeline (event-driven)
│       ├── auto-discover-affiliates.ts # Daily cron (8AM UTC)
│       └── hello-world.ts             # Health check function
│
├── telegram/                    # Telegram bot
│   ├── telegram-bot.ts          # Bot instance + command registration
│   ├── telegram-client.ts       # Low-level API client
│   ├── telegram-command-handlers.ts
│   ├── telegram-auth-middleware.ts
│   ├── telegram-rate-limit-middleware.ts
│   ├── telegram-fsm-state-manager.ts
│   ├── telegram-keyboard-builder.ts
│   └── telegram-message-formatter.ts
│
├── supabase/                    # Database clients
│   ├── server.ts                # SSR client (cookies-based, @supabase/ssr)
│   ├── client.ts                # Browser client
│   ├── admin.ts                 # Admin client (SERVICE_ROLE_KEY)
│   └── types.ts                 # Generated DB types
│
├── payments/                    # Polar.sh payment integration
│   ├── polar-types.ts
│   ├── polar-pricing-calculator.ts
│   ├── polar-subscription-service.ts
│   └── polar-webhook-handler.ts
│
├── services/                    # Service layer (factory pattern)
│   ├── factory.ts               # ServiceFactory (mock vs real toggle)
│   ├── types.ts                 # Service interfaces
│   ├── real/                    # Production implementations
│   │   ├── script-service.ts
│   │   ├── voice-service.ts
│   │   ├── video-service.ts
│   │   └── payment-service.ts
│   └── mock/                    # Test/dev implementations
│       ├── script-service.ts
│       ├── voice-service.ts
│       └── payment-service.ts
│
├── auth.ts                      # getCurrentUser(), tier helpers
├── affiliates.ts                # Affiliate program catalog
├── features.ts                  # Feature flags per tier
├── tier-guard.ts                # Tier-based access control
└── schemas.ts                   # Zod validation schemas
```

---

## Integration Points / Diem Tich Hop

| Service | Purpose | Connection |
|---------|---------|------------|
| **Supabase** | Postgres DB, Auth (Magic Link), Storage | `@supabase/ssr` + `@supabase/supabase-js` |
| **Inngest** | Background jobs, cron scheduling | `POST /api/inngest` webhook |
| **Telegram** | Bot commands, notifications | `POST /api/webhooks/telegram` (Telegraf) |
| **OpenRouter** | AI script generation (multi-model) | REST API, key in env |
| **HeyGen** | Avatar video generation | REST API, polling for status |
| **ElevenLabs** | Text-to-speech voiceover | REST API |
| **Polar.sh** | Subscriptions, payment webhooks | `POST /api/webhooks/polar` |
| **Upstash Redis** | Rate limiting, session cache | `@upstash/redis` |

---

## Deployment Architecture / Kien Truc Trien Khai

```
┌─────────────────────────────────────────────────────────────┐
│                        Vercel                                │
│  ┌────────────────┐  ┌──────────────┐  ┌─────────────────┐  │
│  │  Edge Runtime   │  │  Serverless  │  │  Static Assets  │  │
│  │  (Middleware)   │  │  (API/SSR)   │  │  (Next.js)      │  │
│  └────────┬───────┘  └──────┬───────┘  └─────────────────┘  │
│           │                 │                                 │
└───────────┼─────────────────┼─────────────────────────────────┘
            │                 │
            ▼                 ▼
┌───────────────────┐  ┌──────────────┐  ┌──────────────────┐
│    Supabase       │  │   Inngest    │  │  External APIs   │
│  (Postgres+Auth   │  │  (BG Jobs)   │  │  OpenRouter      │
│   +Storage)       │  │              │  │  HeyGen          │
│                   │  │              │  │  ElevenLabs      │
│                   │  │              │  │  Polar.sh        │
└───────────────────┘  └──────────────┘  └──────────────────┘
```

### Environment Variables (Required)

| Variable | Service |
|----------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon/public key |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase admin operations |
| `INNGEST_SIGNING_KEY` | Inngest webhook verification |
| `INNGEST_EVENT_KEY` | Inngest event sending |
| `OPENROUTER_API_KEY` | AI script generation |
| `HEYGEN_API_KEY` | Video generation |
| `ELEVENLABS_API_KEY` | Voice generation |
| `TELEGRAM_BOT_TOKEN` | Telegram bot |
| `TELEGRAM_ADMIN_CHAT_ID` | Admin notifications |
| `POLAR_ACCESS_TOKEN` | Payment processing |
| `POLAR_WEBHOOK_SECRET` | Webhook verification |
| `API_ENCRYPTION_KEY` | User API key encryption |
| `ADMIN_USER` / `ADMIN_PASS` | Admin panel Basic Auth |
| `UPSTASH_REDIS_REST_URL` | Redis cache/rate limiting |
| `UPSTASH_REDIS_REST_TOKEN` | Redis auth |

---

## Tier System / He Thong Goi

| Feature | BASIC | PREMIUM | ENTERPRISE |
|---------|-------|---------|------------|
| Price/month | $500 | $1,200 | $3,500 |
| YouTube Channels | 1 | 3 | Unlimited |
| Videos/month | 20 | 100 | Unlimited |
| Templates | 5 | Unlimited | Unlimited + Custom |
| Auto YouTube Publish | No | Yes | Yes |
| Auto-Discovery | No | Yes | Yes |
| Gateway Channels | Telegram only | +YouTube | +YouTube +TikTok |

Tier enum: `BASIC | PREMIUM | ENTERPRISE` (strict uppercase, stored in `user_metadata.tier`)

---

## API Routes / Duong Dan API

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/health` | GET | Health check |
| `/api/webhooks/polar` | POST | Polar.sh payment events |
| `/api/webhooks/telegram` | POST | Telegram bot updates |
| `/api/inngest` | POST | Inngest function runner |
| `/api/admin/invite` | POST | Admin user invite (Basic Auth) |
| `/auth/callback` | GET | Supabase Magic Link callback |
