# Project: APAC Multi-Language AI Video Dubbing, Creator Marketplace & Autonomous Syndication Mesh Engine

## Architecture
Clean 4-Layer Architecture (`seed` -> `tree` -> `forest` -> `land`) for Sophia AI Factory on Cloudflare Workers edge:
- **Seed Layer (`src/seed/`)**: Pure types, constants, Zod schemas, voice presets (VI, EN, JA, KO, TH), and Web Crypto HMAC-SHA256 signature utilities. No dependencies on upper layers.
- **Tree Layer (`src/tree/`)**: Pure domain logic and reusable algorithms without side effects. Contains subtitle formatters (SRT/VTT), APAC geo-router, dynamic forensic watermark generators, 70/30 integer royalty calculations & OCC CAS ledger engine, APAC golden hour peak optimizer, and viral metadata generators.
- **Forest Layer (`src/forest/`)**: Infrastructure orchestrators, background workers, Inngest workflows, and cron tasks. Contains video voice dubbing workflow, Edge TTS gateway, Cloudflare Stream client, HLS manifest generator, social token refreshers, and publishing scheduler.
- **Land Layer (`src/land/`) & App Routes (`src/app/`)**: User-facing business operations, Server Actions, D1 database mutations, API routes, and UI components. Includes Creator Studio (`/creator/studio`, `/vi/creator/studio`), dual-rail payouts (USDT & VietQR), social publisher adapters, 24h signed video download endpoint, and adaptive HLS video player.

## Feature Inventory
Every feature from the Survey phase is enumerated below with its assigned milestone. No feature is left unassigned.

| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| 1 | Audio Extraction & STT | Extracts audio track from video and transcribes to timestamped segments via Whisper/STT | M1 | Survey (R1) |
| 2 | 5-Language Contextual Translation | Translates transcript segments into 5 APAC languages (VI, EN, JA, KO, TH) preserving regional tone | M1 | Survey (R1) |
| 3 | Synchronized Subtitle Generator | Formats and serializes translated segments into standard `.srt` and `.vtt` subtitle files | M1 | Survey (R1) |
| 4 | Native APAC Voice Synthesis & Audio Sync | Synthesizes native speech via ElevenLabs / Edge TTS matched to scene duration and tempo | M1 | Survey (R1) |
| 5 | Smart Localization Router | Detects user browser `Accept-Language` and `cf-ipcountry` to route to localized UI, videos, checkout | M1 | Survey (R1) |
| 6 | APAC Voice Presets Expansion | Expands `VoiceLanguage` and registers native voice presets for JA, KO, TH in `presets.ts` | M1 | Survey (R1) |
| 7 | Bilingual Locale Files & Routing | Expands supported locales to `['en', 'vi', 'ja', 'ko', 'th']` with baseline JSON dictionaries | M1 | Survey (R1) |
| 8 | D1 `creator_templates` Registry | Manages reusable viral video templates, storyboards, prompt styles, and music in Cloudflare D1 | M2 | Survey (R2) |
| 9 | Template Review & Quality Rating FSM | FSM governing template lifecycle (`draft`, `pending`, `approved`, `rejected`, `archived`) with ratings | M2 | Survey (R2) |
| 10 | 70/30 Royalty Revenue Split Math | Pure integer calculation allocating 70% of template fee to creator and 30% to platform with zero leakage | M2 | Survey (R2) |
| 11 | OCC CAS Creator Earnings Accrual | Idempotent Compare-And-Swap ledger insertion with monotonic sequence tracking on template activation | M2 | Survey (R2) |
| 12 | Anti-Fraud Lineage Traversal | Traverses parent lineage graph up to depth 10 to block self-remix and circular exploitation | M2 | Survey (R2) |
| 13 | Bilingual Creator Studio Portal | Administrative UI (`/creator/studio`, `/vi/creator/studio`) for template analytics and earnings | M2 | Survey (R2) |
| 14 | Multi-Rail Creator Payouts (USDT / VietQR) | Supports payout withdrawal requests via USDT TRC20/ERC20 and Vietnamese bank accounts via VietQR | M2 | Survey (R2) |
| 15 | D1 Migration `0291_creator_templates` | Schema migration for `creator_templates`, `creator_withdrawal_requests`, and VietQR banking columns | M2 | Survey (R2) |
| 16 | Omnichannel Video Publishing Adapter Mesh | Dispatches video uploads to YouTube Shorts, TikTok, Instagram Reels, and Facebook Reels | M3 | Survey (R3) |
| 17 | OAuth2 Platform Token Lifecycle & Refresh | Manages long-lived and short-lived platform tokens with automated background refresh | M3 | Survey (R3) |
| 18 | APAC Peak-Time Scheduling Optimizer | Golden-hour scheduler for Hà Nội (11:30 & 19:30), Tokyo (12:00 & 20:00), Bangkok (12:00 & 20:30) | M3 | Survey (R3) |
| 19 | Multi-Channel Anti-Collision & Stagger | Staggers consecutive channel dispatches by 5 min and resolves database slot collisions | M3 | Survey (R3) |
| 20 | Account Protection Cooldown & Deferral | Checks provider rate limits/cooldowns before job creation; defers jobs safely instead of dropping | M3 | Survey (R3) |
| 21 | Viral Metadata Generator | Generates localized click-worthy hook titles, SEO descriptions, trending hashtags, and CTR thumbnail specs | M3 | Survey (R3) |
| 22 | Tracked Funnel & Telegram Bot Deep Linking | Injects UTM attribution tracking parameters and Telegram bot `/start` payloads into syndicated captions | M3 | Survey (R3) |
| 23 | Adaptive Bitrate HLS Stream Generator | Generates multi-variant HLS master manifest (`.m3u8`) for 1080p, 720p, and 480p streams | M4 | Survey (R4) |
| 24 | Global Edge CDN Caching Mesh | Caches video chunks and manifests across Cloudflare edge network via `VIDEO_BUCKET` R2 binding | M4 | Survey (R4) |
| 25 | Dynamic Forensic Watermarking | Injects semi-transparent forensic watermark (Client Tenant ID / User hash / Timestamp) into previews | M4 | Survey (R4) |
| 26 | 24-Hour HMAC Signed Download URLs | Generates HMAC-SHA256 signed download links with 24-hour timestamp expiry to block hotlinking | M4 | Survey (R4) |
| 27 | Adaptive Video Player Client Component | Next.js client component supporting HLS playback, quality switcher, and forensic watermark overlay | M4 | Survey (R4) |
| 28 | 4-Layer Clean Architecture Enforcement | Strict separation of concerns (seed -> tree -> forest -> land) with 0 violations | M5 | Survey (R5) |
| 29 | TypeScript Strict Compilation Gate | Full TypeScript type check with 0 errors and zero `:any` types allowed in production code | M5 | Survey (R5) |
| 30 | Production Bit-for-Bit SHA Parity | Verifies commit SHA matches live edge endpoint `https://sophia.agencyos.network/api/version` | M5 | Survey (R5) |
| 31 | Sophia Doctor 11/11 Diagnostic Health | Comprehensive automated health check reporting 11/11 GREEN pass score | M5 | Survey (R5) |

## Milestones

| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| M1 | APAC Video Dubbing & Subtitles Engine | Voice presets (VI, EN, JA, KO, TH), SRT/VTT formatters, smart geo-router, dubbing workflow & i18n routing | none | DONE |
| M2 | Autonomous Creator Marketplace & 70/30 Protocol | D1 migration 0291, template registry & ratings, 70/30 royalty split, OCC CAS ledger, bilingual `/creator/studio`, USDT & VietQR payouts | none | DONE |
| M3 | Multi-Platform Syndication & Peak-Time Scheduling | Omnichannel publishing (YouTube Shorts, TikTok, IG Reels, FB Reels), APAC peak optimizer (Hà Nội, Tokyo, Bangkok), viral metadata generator | M1 | DONE |
| M4 | Global Edge CDN & Adaptive HLS Streaming | Adaptive HLS m3u8 generator, Cloudflare Stream & R2 bridge, dynamic forensic watermark, 24h HMAC signed download URLs | none | DONE |
| M5 | Final Integration, E2E Test Suite & Quality Gates | Pass 100% of E2E tests (Tiers 1-4), adversarial test hardening (Tier 5), 0 layer boundary violations, 0 TS errors, 11/11 Sophia Doctor | M1, M2, M3, M4, E2E-Track | DONE |
| E2E | E2E Testing Track | Requirement-driven test harness and test suites across Tiers 1-4 for all 31 features, publishes `TEST_READY.md` | none | DONE |

## Interface Contracts

### M1 (Dubbing & Localization) ↔ M3 (Syndication) & M4 (HLS)
- `ApacLocale`: `'vi' | 'en' | 'ja' | 'ko' | 'th'`
- `SubtitleFormat`: `'srt' | 'vtt'`
- `DubbingResult`: `{ jobId: string; videoUrl: string; audioTrackUrls: Record<ApacLocale, string>; subtitleUrls: Record<ApacLocale, { srt: string; vtt: string }> }`

### M2 (Creator Marketplace) ↔ Core Billing & Studio
- `CreatorTemplate`: `{ id: string; creatorId: string; title: string; niche: string; scriptTemplate: string; storyboardJson: string; visualStylePrompt: string; priceCents: number; royaltyPct: number; status: 'draft'|'pending'|'approved'|'rejected'|'archived' }`
- `RoyaltySplit`: `{ creatorCents: number; platformCents: number; sequenceNum: number; newBalanceCents: number }`
- `WithdrawalRequest`: `{ id: string; creatorId: string; amountCents: number; rail: 'USDT' | 'VIETQR'; destination: string; status: 'pending'|'processing'|'completed' }`

### M3 (Syndication) ↔ Scheduler & Publishers
- `ApacMarket`: `'hanoi' | 'tokyo' | 'bangkok' | 'seoul' | 'singapore'`
- `ViralMetadata`: `{ hookTitle: string; seoDescription: string; hashtags: string[]; thumbnailPrompt: string; trackedFunnelUrl: string }`
- `PublishingScheduleInput`: `{ videoId: string; channels: string[]; market: ApacMarket; userRequestedTime?: number }`

### M4 (Edge CDN & HLS) ↔ Storage & Client Player
- `HlsMasterManifest`: `{ masterPlaylistUrl: string; variants: Array<{ quality: '1080p'|'720p'|'480p'; bandwidth: number; url: string }> }`
- `SignedDownloadToken`: `createSignedDownloadToken(videoId: string, userId: string, ttlSec: number, secret: string) -> string`
- `DynamicWatermark`: `generateForensicWatermarkText(tenantId: string, userId: string) -> string`

## Code Layout
```
apps/sophia-ai-factory/src/
├── seed/
│   ├── types/
│   │   ├── dubbing.ts                  # M1: Dubbing & Subtitle types
│   │   ├── creator-marketplace.ts      # M2: Creator Marketplace types
│   │   ├── apac-syndication.ts         # M3: Syndication & Viral types
│   │   └── streaming.ts                # M4: HLS & Streaming types
│   ├── voices/
│   │   └── presets.ts                  # M1: APAC voice presets (JA, KO, TH)
│   └── security/
│       └── signed-url.ts               # M4: HMAC-SHA256 24h URL signing
├── tree/
│   ├── subtitles/
│   │   └── subtitle-formatter.ts       # M1: SRT and VTT formatters
│   ├── localization/
│   │   └── geo-router.ts               # M1: Smart geo & accept-language router
│   ├── creator-royalties/
│   │   ├── attribution.ts              # M2: OCC CAS ledger engine
│   │   └── template-activation.ts      # M2: 70/30 royalty split logic
│   ├── publishing/
│   │   ├── apac-peak-optimizer.ts      # M3: Hanoi, Tokyo, Bangkok golden hours
│   │   └── viral-metadata-generator.ts # M3: Multi-language hook & metadata generator
│   └── watermark/
│       └── forensic-watermark.ts       # M4: Dynamic forensic watermark generator
├── forest/
│   ├── inngest/functions/
│   │   └── video-voice-dubbing.ts      # M1: Dubbing pipeline workflow
│   ├── publishing/
│   │   ├── scheduler.ts                # M3: APAC peak-time scheduler integration
│   │   └── viral-distributor.ts        # M3: Omnichannel publisher dispatcher
│   └── streaming/
│       └── hls-manifest-generator.ts   # M4: Adaptive HLS manifest builder
├── land/
│   ├── video/dubbing/                  # M1: Dubbing service & Server Actions
│   ├── creator/                        # M2: Studio analytics & withdrawal service
│   └── video/publishing/providers/     # M3: YouTube, TikTok, IG Reels, FB Reels
└── app/
    ├── [locale]/(app)/creator/studio/  # M2: Bilingual Creator Studio UI
    ├── api/creator/                    # M2: Creator API endpoints
    ├── api/videos/[id]/download/       # M4: 24h signed URL verification route
    └── api/videos/[id]/hls/            # M4: Adaptive HLS streaming manifest route
```
