# Project: Sophia AI Factory — Full Roadmap Next Horizon (Phases 15–16 & Enterprise Autonomy)

## Architecture
Sophia AI Factory is a Cloudflare Workers-native AI creative studio and autonomous social publishing platform.
The architecture strictly adheres to the 4-layer dependency model:
- `seed`: Pure primitives, types, cryptographic utilities, telemetry SDK, database clients (`@/seed/*`).
- `tree`: Business logic, domain repositories, quotas, BYOK encryption, audit log hashing (`@/tree/*`).
- `forest`: Workflows, Inngest orchestration, multi-track coordinators, publisher schedulers (`@/forest/*`).
- `land`: Edge entry points, Next.js Server Actions, route handlers, external publisher adapters, UI components (`@/land/*`, `app/*`).

Key sub-systems for Next Horizon:
1. **Multi-Model AI Video Generation Pipeline (Phase 16)**: Multi-track coordinator orchestrating script synthesis (`AI_TEXT`), ElevenLabs TTS (`AI_AUDIO`), visual frame synthesis (`fal.ai` Flux-schnell), and video rendering (`KlingVideoClient`, `HunyuanVideo`). Atomic OCC state machine (`queued` -> `scripting` -> `rendering` -> `completed` / `failed`) with Cloudflare R2 (`VIDEO_BUCKET`) tenant-scoped vaulting.
2. **Autonomous Multi-Channel Social Publisher Fleet**: Adapters for YouTube Shorts (Data API v3 with auto token refresh), TikTok Shop (Partner API v2 + Direct Post), Instagram Reels (Graph API v19.0 REELS container), and Telegram Bot API (`sendVideo`). OCC atomic CAS job claim, exponential backoff on 429/5xx, and viral performance metrics ingestion.
3. **Enterprise Security Vault & Observability**: BYOK AES-256-GCM encryption with AAD tenant isolation, automated key rotation daemon (`/api/admin/byok-rotation`), OpenTelemetry (OTEL) with Honeycomb edge tracing, and SOC 2 Type I immutable hash-chain audit logging (`raas_audit_logs`).
4. **Customer Journey E2E & Reliability Suite (Phase 15)**: Automated Playwright browser test suite covering all 5 bilingual customer journeys (VI/EN), performance TTFB < 300ms, and 0 unhandled client-side exceptions.

## Feature Inventory
| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| 1 | Multi-Track Video Coordinator | Coordinates script synthesis, ElevenLabs TTS audio, visual frames (fal.ai), and video rendering (Kling / Hunyuan) | M1 | ORIGINAL_REQUEST §R2 |
| 2 | Unified Video Provider Factory | Register Kling AI and HunyuanVideo as standard video rendering providers in `provider-factory.ts` | M1 | Survey 2 |
| 3 | Composite Pre-Flight Quota Check | 7-gate preflight checking multi-track capabilities (`AI_TEXT`, `AI_AUDIO`, `AI_IMAGE`, `AI_VIDEO`), MCU balance & $5 spike guard | M1 | ORIGINAL_REQUEST §R2 |
| 4 | BYOK Key Encryption & Vaulting | AES-256-GCM key decryption for ElevenLabs, fal.ai, Kling, Runpod with AAD tenant isolation | M1 | ORIGINAL_REQUEST §R2 |
| 5 | Real-Time Video Preview State Machine | Atomic state transitions (`queued` -> `scripting` -> `rendering` -> `completed`/`failed`) and D1 `creative_missions` OCC updates | M1 | ORIGINAL_REQUEST §R2 |
| 6 | Cloudflare R2 Asset Vaulting | Store generated scripts, audio, visuals, and videos under tenant-scoped R2 keys (`VIDEO_BUCKET`) | M1 | ORIGINAL_REQUEST §R2 |
| 7 | Studio Mission Creation Wiring | Connect `/dashboard/missions/new` (`first-run-wizard.tsx`) to live server actions and track status persistence | M1 | Survey 1 |
| 8 | YouTube Shorts Publisher Adapter | Resumable upload via Data API v3 with automatic OAuth token refresh and status polling | M2 | ORIGINAL_REQUEST §R3 |
| 9 | TikTok Shop & Direct Post Adapter | Partner API v2 affiliate product sync + Direct Post video upload with HMAC-SHA256 signatures | M2 | ORIGINAL_REQUEST §R3 |
| 10 | Instagram Reels Publisher Adapter | Meta Graph API v19.0 REELS container creation, status polling, and publish | M2 | ORIGINAL_REQUEST §R3 |
| 11 | Telegram Bot Video Publisher | Telegram Bot API `sendVideo` with MarkdownV2 escaping and paired chat verification | M2 | ORIGINAL_REQUEST §R3 |
| 12 | Idempotent Scheduler Cron | OCC CAS job claim (`atomicClaimJob`), peak audience timezone slots, and channel cooldown deferral | M2 | ORIGINAL_REQUEST §R3 |
| 13 | Exponential Backoff Retry Queue | Exponential backoff delay on HTTP 429/5xx for social publishing retries in `scheduleRetry` | M2 | ORIGINAL_REQUEST §R3 |
| 14 | Viral Performance Metrics Ingestion | Webhook receivers (YouTube, TikTok) and recurring analytics sync for social metrics | M2 | ORIGINAL_REQUEST §R3 |
| 15 | BYOK Key Rotation Endpoint | Admin endpoint `/api/admin/byok-rotation` supporting AES-256-GCM versioned re-encryption | M3 | ORIGINAL_REQUEST §R4 |
| 16 | Background Key Re-encryption Daemon | Inngest function `keyRotationReencrypt` batch re-encrypting credentials with 7-day dual-decrypt window | M3 | ORIGINAL_REQUEST §R4 |
| 17 | Automatic 90-Day Key Rotation Cron | Inngest cron checking active key age and provisioning new version if >= 90 days old | M3 | ORIGINAL_REQUEST §R4 |
| 18 | OpenTelemetry SDK Edge Instrumentation | Edge-compatible OTLP HTTP trace & metric export to Honeycomb via native `fetch()` | M3 | ORIGINAL_REQUEST §R4 |
| 19 | API Latency & D1 Tracing Wrapper | Higher-order route wrapper `instrumentRoute` recording duration, errors, and percentile metrics | M3 | ORIGINAL_REQUEST §R4 |
| 20 | SOC 2 Type I Immutable Hash-Chain | Audit log hash chaining (`previous_log_hash`, `content_hash`) in `raas_audit_logs` table | M3 | ORIGINAL_REQUEST §R4 |
| 21 | Hash-Chain Verification Daemon | Daily automated verification cron validating SHA-256 hash continuity across audit logs | M3 | ORIGINAL_REQUEST §R4 |
| 22 | HMAC Compliance Receipts | Cryptographically signed compliance receipts for audit records with 1-hour TTL | M3 | ORIGINAL_REQUEST §R4 |
| 23 | Playwright Guest Auth Journey E2E | Bilingual guest discovery to registration and magic-link authentication (`/vi/login`, `/en/login`, `/register`) | M4 | ORIGINAL_REQUEST §R1 |
| 24 | Playwright Setup Wizard Journey E2E | 6-step Onboarding Setup Wizard (`/setup`, `/setup-wizard`) with BYOK validation probes | M4 | ORIGINAL_REQUEST §R1 |
| 25 | Playwright Creative Studio Journey E2E | Creative Studio mission creation (`/dashboard/missions/new`) with pre-flight MCU/USD calculation | M4 | ORIGINAL_REQUEST §R1 |
| 26 | Playwright Distribution Queue Journey E2E | Scheduled distribution and publishing queue (`/dashboard/videos`) | M4 | ORIGINAL_REQUEST §R1 |
| 27 | Playwright Checkout Journey E2E | Self-serve subscription checkout with NOWPayments USDT invoice and PayOS VN QR code flows | M4 | ORIGINAL_REQUEST §R1 |
| 28 | Production Reliability & TTFB Benchmark | HTTP 200/307 verification, 0 HTTP 500 errors, TTFB < 300ms median, and 0 unhandled client exceptions | M4 | ORIGINAL_REQUEST §R1 |
| 29 | 4-Layer Architecture Enforcement | `scripts/check-layer-boundaries.sh` validation with 0 violations | M5 | ORIGINAL_REQUEST §R5 |
| 30 | TypeScript Zero-Error Compilation | `npm run type-check` exits with code 0 across entire codebase | M5 | ORIGINAL_REQUEST §R5 |
| 31 | 100% Test Suite Verification | Full unit and integration test suite execution with 100% pass rate | M5 | ORIGINAL_REQUEST §R5 |
| 32 | Cloudflare Workers Live Edge Deploy | Deploy via CF-direct doctrine and verify live edge SHA match at `/api/version` | M5 | ORIGINAL_REQUEST §R5 |
| 33 | Sophia Doctor Production Health Audit | `node scripts/sophia-doctor.mjs` reports 11/11 GREEN (100% score) | M5 | ORIGINAL_REQUEST §R5 |

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| 1 | M1: Next-Gen Multi-Model AI Video Generation Pipeline | Multi-track coordinator, Kling/Hunyuan/fal.ai adapters in provider factory, composite preflight, R2 vaulting, Studio UI wiring | None | DONE |
| 2 | M2: Autonomous Multi-Channel Social Publisher Fleet | Social publisher adapters (YouTube, TikTok, Instagram, Telegram), exponential backoff retry in `publish-execute`, metrics harvester | None | DONE |
| 3 | M3: Enterprise Security Vault, Key Rotation & Observability | `/api/admin/byok-rotation` route, Inngest re-encryption daemon, Honeycomb/OTEL tracing, immutable hash-chain audit logging | None | DONE |
| 4 | M4: Comprehensive Playwright Customer Journey E2E & Reliability Suite | Playwright E2E customer journey suite (5 bilingual journeys VI/EN), route health audit (zero 500s), TTFB < 300ms benchmark | M1, M2, M3 | DONE |
| 5 | M5: Layer Architecture Discipline, Full Verification & Live Edge Deploy | Layer boundaries check, `npm run type-check`, full vitest suite pass, CF-direct deploy, live SHA match, Sophia Doctor 11/11 GREEN | M4 | IN_PROGRESS |

## Interface Contracts
### Multi-Track Video Orchestrator
- Function: `executeMultiTrackMission(missionId: string, options?: MultiTrackOptions): Promise<MultiTrackResult>`
- File: `apps/sophia-ai-factory/src/forest/mission/multi-track-orchestrator.ts`
- Events: Emits `creative.mission.multitrack.requested`, `creative.mission.multitrack.progress`, `creative.mission.multitrack.completed`
- Video Providers: `FalImageProvider` (Flux-schnell), `KlingVideoClient` (fal queue), `HunyuanVideoClient` (Runpod)

### Social Publisher Fleet
- Interface: `Publisher { upload(videoUrl: string, meta: PublishMeta): Promise<string>; pollStatus(externalPostId: string): Promise<PublishStatus>; getMetrics(externalPostId: string): Promise<MetricsJson>; }`
- Files: `src/forest/publishing/publisher-interface.ts`, `src/land/video/publishing/providers/*`, `src/tree/publishing/providers/telegram-publisher.ts`
- Job Scheduling: `scheduleJob(input: SchedulePublishInput): Promise<PublishingJob>`
- Retry Handler: `scheduleRetry(jobId: string, tenantId: string, userId: string, attempt: number, delayMs?: number): Promise<void>`

### Security Vault & Observability
- Endpoint: `POST /api/admin/byok-rotation` (supports alias to `/api/admin/keys/rotate`)
- Crypto: `encryptApiKeyText(plain: string, userId: string, keyVersion?: number): Promise<string>`
- Tracing: `instrumentRoute(route: string, method: string, handler: RouteHandler): RouteHandler`
- Hash-chain: `computeContentHash(entry: AuditEntry, prevHash: string): string`, `verifyHashChain(logs: AuditLog[]): HashChainVerificationResult`

## Code Layout
- Playwright E2E Suite: `apps/sophia-ai-factory/tests/e2e/customer-journey-next-horizon.spec.ts`
- Video Generation Pipeline: `apps/sophia-ai-factory/src/forest/mission/`, `apps/sophia-ai-factory/src/land/video/`
- Social Publisher Fleet: `apps/sophia-ai-factory/src/forest/publishing/`, `apps/sophia-ai-factory/src/forest/inngest/functions/publish-execute.ts`
- Security & Key Rotation: `apps/sophia-ai-factory/src/tree/byok/`, `apps/sophia-ai-factory/src/app/api/admin/byok-rotation/`
- Observability: `apps/sophia-ai-factory/src/seed/telemetry/`, `apps/sophia-ai-factory/src/seed/observability/`
- Layer Verification: `scripts/check-layer-boundaries.sh`
- Sophia Doctor: `scripts/sophia-doctor.mjs`
- Live Edge Deployment: `apps/sophia-ai-factory/scripts/deploy-with-sha.sh`, `npm run deploy:full`
