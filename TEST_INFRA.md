# TEST_INFRA — APAC Multi-Language Video Dubbing, Creator Marketplace & Autonomous Syndication Engine

## 1. Test Philosophy & Architecture

The E2E Testing Suite for the **APAC Multi-Language AI Video Dubbing, Creator Marketplace & Autonomous Syndication Mesh Engine** adheres to an **opaque-box, contract-driven, deterministic verification methodology** derived strictly from `/Users/macbook/sophia-ai-factory/.agents/teamwork/ORIGINAL_REQUEST.md`, `/Users/macbook/sophia-ai-factory/PROJECT.md`, and `/Users/macbook/sophia-ai-factory/.agents/teamwork/spec_miner_survey_1/handoff.md`.

### Core Engineering Invariants:
1. **Decoupling from Transients**: Tests verify observable inputs, outputs, database mutations, state transitions, and protocol responses rather than volatile internal implementation details.
2. **Deterministic In-Memory Cloudflare D1 Simulation**: Built upon `tests/e2e/harness/e2e-test-harness.ts` wrapping Node.js native `DatabaseSync` (`node:sqlite`). Zero external network dependencies, zero flaky network timeouts, zero shared test state, and sub-second full-suite execution (323 tests in <500ms).
3. **Strict 4-Layer Architecture Adherence**: Conforms to `seed` -> `tree` -> `forest` -> `land` boundaries with 0 violations (`bash scripts/check-layer-boundaries.sh` 100% clean). Zero `:any` types.
4. **Deterministic Web Crypto Primitives**: Web Crypto timing-safe HMAC-SHA256 signature generation and verification for 24-hour video download links, CSPRNG token generators, and millisecond-accurate timestamp drift assertions.
5. **OCC CAS Concurrency & Anti-Fraud Ledger**: Models Optimistic Concurrency Control Compare-And-Swap ledger insertions with monotonic sequence tracking, full jitter retry backoff, and 10-depth lineage traversal graph cycle detection.

---

## 2. 4-Tier Testing Methodology

The testing architecture is partitioned into four orthogonal, progressive tiers:

### Tier 1 — Feature Coverage ($\ge 5$ tests per feature, 155 tests total)
Verifies nominal, happy-path execution of all 31 features in isolation:
- **R1 (Dubbing & Localization — Features 1–7)**: Audio extraction, STT transcription, 5-language contextual translation (VI, EN, JA, KO, TH), synchronized SRT/VTT subtitle generation, smart geo/header localization routing, APAC voice presets expansion, and bilingual locale files & routing.
- **R2 (Creator Marketplace — Features 8–15)**: D1 `creator_templates` registry, review & 5-star rating FSM, 70/30 pure integer royalty split math, OCC CAS ledger accrual, anti-fraud lineage traversal, bilingual Creator Studio portal (`/creator/studio`), dual-rail payouts (USDT & VietQR), and D1 migration `0291_creator_templates`.
- **R3 (Syndication Mesh — Features 16–22)**: Omnichannel publishing mesh (YouTube Shorts, TikTok, IG Reels, FB Reels), OAuth2 platform token refresh lifecycle, APAC golden-hour peak optimizer (Hà Nội, Tokyo, Bangkok), multi-channel anti-collision & 5-min stagger, provider cooldown deferral, viral metadata generator, and UTM + Telegram deep linking.
- **R4 (Edge CDN & HLS — Features 23–27)**: Adaptive bitrate HLS master manifest generator (1080p, 720p, 480p), global edge CDN caching mesh via R2, dynamic forensic watermarking, 24-hour HMAC-SHA256 signed download URLs, and adaptive video player client component.
- **R5 (Quality Gates — Features 28–31)**: 4-layer clean architecture enforcement (0 violations), strict TypeScript compilation gate (0 errors, 0 `:any`), production bit-for-bit SHA parity, and Sophia Doctor 11/11 diagnostic health suite.

### Tier 2 — Boundary, Corner & Adversarial Cases ($\ge 5$ tests per feature, 155 tests total)
Evaluates extreme inputs, edge conditions, security violations, and failure modes across all 31 features:
- Inverted/corrupted timestamps (`startMs > endMs`), zero-duration audio, extreme 4-hour video durations, and script injection sanitization.
- Unsupported language codes, emoji-dense transcripts, 5000+ character line auto-wrapping, and HTML tag stripping.
- Subtitle formatting for hours > 99, standard arrow delimiter escaping (`-->`), and cue number re-indexing.
- Voice duration overflow (>30%) script condensation triggers, audio underflow (<50%) padding triggers, volume clipping prevention, and invalid preset ID handling.
- Missing HTTP headers, malformed `Accept-Language` with invalid q-values, uppercase/lowercase country code normalization, and unsupported path segments redirect.
- Tier gates preventing Basic tier users from accessing Premium neural presets, duplicate preset ID rejections, and displayName length bounds.
- Missing translation key fallback cascades, unescaped HTML quotes, nested key traversal, and double slash route normalization.
- Negative template prices, malformed non-JSON storyboard payloads, foreign key constraint violations, and royalty percent clamping [0, 100].
- Illegal FSM jumps (`rejected` -> `approved`), ratings by non-remixers, non-integer star scores, review XSS sanitization, and zero-division guards.
- Negative revenue rejection, 100% / 0% royalty boundary conditions, 1-cent fee fractional cent truncation, and $10,000 transaction handling without overflow.
- High-concurrency CAS conflict retries with exponential jitter, sequence gap detection, and duplicate referenceId idempotency.
- Multi-hop circular remix cycle detection (up to depth 10), orphaned blueprint handling, and depth parameter bounding.
- Unauthenticated studio session redirects, zero-balance currency formatting ($0.00 / 0 ₫), bio XSS sanitization, and date range bounding.
- Withdrawal exceeding balance rejection, $50 minimum threshold enforcement, USDT TRC20 address regex validation, VietQR bank format validation, and atomic double-withdrawal race prevention.
- Schema migration idempotency, non-null column constraints, default values verification, and database transaction rollback safety.
- Third-party provider HTTP 500 errors, network timeout aborts, circuit breaker tripping on consecutive failures, and missing R2 video keys.
- Proactive token refresh margins, revoked refresh token handling, clock skew tolerance (60s), and secret redaction.
- Unrecognized timezone fallback to UTC slots, exact peak minute boundaries, midnight transitions, and Singapore UTC+8 peak slots.
- Anti-collision loop cap at 48 iterations (4 hours), negative stagger intervals rejection, and slot alignment.
- Zero-second cooldown pass-through, safety margin additions (+60s), and burst limit deferrals.
- Extreme topic length truncation, unspaced topic strings, hashtag deduplication, and surrogate pair emoji counting.
- Referral code symbol sanitization, Telegram deep link 64-char limit, and UTM parameter percent-encoding.
- Single-variant HLS fallback, negative bandwidth rejection, resolution regex validation, and Unix LF line endings.
- Missing chunk 404 responses, malformed HTTP Range headers, tenant path traversal blocking, and R2 circuit breaker.
- Empty tenant ID fallback watermarks, watermark length bounds, opacity clamping [0.05, 0.40], and position coordinates.
- 1-second past expiry rejection, key mismatch rejection, non-hex signature handling, and timing-safe comparisons.
- Manifest parse failure recovery, playback rate clamping [0.25, 2.0], network offline recovery, and audio-only stream fallbacks.
- Banned legacy import detection, upward layer import blocking, circular dependency detection, and Result type discrimination.
- Exhaustive union switch checking, implicit any detection, live version API timeout handling, and dirty git tree blocking.
- Single probe failure exit code 1 handling, missing required env var detection, and probe timeout handling.

### Tier 3 — Cross-Feature State & Data Sharing Combinations (8 tests)
Verifies multi-feature interactions, data flow pipelines, and cross-boundary invariants:
- **Pair 1**: STT -> 5-Language Translation -> Synchronized SRT/VTT Subtitles across all 5 APAC languages.
- **Pair 2**: Contextual Translation -> Native Voice Synthesis -> Adaptive Bitrate HLS Stream Generator.
- **Pair 3**: Template Registry -> 70/30 Royalty Split -> OCC CAS Monotonic Ledger Accrual.
- **Pair 4**: CAS Ledger Accrual -> Dual-Rail Withdrawal (USDT / VietQR) with balance deduction.
- **Pair 5**: APAC Peak-Time Optimizer -> Anti-Collision Stagger -> Provider Cooldown Deferral.
- **Pair 6**: Viral Metadata Generator -> Tracked Funnel & Telegram Link -> Omnichannel Publishing Mesh.
- **Pair 7**: Adaptive HLS Stream -> Dynamic Forensic Watermark -> 24h HMAC Signed Download URL.
- **Pair 8**: Template Review FSM -> Anti-Fraud Lineage Traversal -> Royalty Distribution.

### Tier 4 — Real-World Multi-Actor Application Scenarios (5 comprehensive workflows)
Simulates realistic end-to-end user workflows and operational journeys:
1. **Scenario 1: Japanese Creator Onboarding & Template Monetization Lifecycle**:
   Tokyo creator onboarded with USDT TRC20 wallet -> publishes viral recipe ($2.99) -> approved by admin -> Vietnamese user remixes -> 70/30 split (209c creator / 90c platform) -> 25 remixes accumulate >$50 -> creator requests $50 USDT withdrawal -> balance deducted and transaction hash archived.
2. **Scenario 2: APAC 5-Language Video Dubbing & Subtitle Production Pipeline**:
   10-second product launch video ingested -> Whisper STT generates timestamped segments -> translated into EN, JA, KO, TH -> synchronized SRT and VTT subtitles generated for all 5 languages -> native neural speech synthesized with duration alignment -> ready status published.
3. **Scenario 3: Tokyo & Hanoi Golden-Hour Cross-Platform Syndication Mesh**:
   Multi-platform syndication targeting Hanoi (11:30 & 19:30) and Tokyo (12:00 & 20:00) -> dispatches staggered across YouTube Shorts, TikTok, IG Reels, FB Reels by 300s -> localized viral metadata generated with UTM attribution and Telegram bot deep links.
4. **Scenario 4: High-Concurrency Template Remixing with Anti-Fraud Lineage Protection**:
   Multi-hop derivative chain A -> B -> C created -> circular self-remix attempt by Creator A blocked by 10-depth lineage traversal -> 10 concurrent genuine users remix Template B simultaneously -> OCC CAS ledger processes all 10 transactions sequentially with exponential jitter -> creator balance reaches exact 1400c ($14.00) with zero leakage.
5. **Scenario 5: Secure Adaptive HLS Streaming with Dynamic Forensic Watermarking & 24h Expiry**:
   Master HLS manifest generated with 1080p, 720p, 480p variants -> dynamic forensic watermark text computed with tenant ID + viewer hash -> 24h HMAC-SHA256 signed download URL generated -> valid download accepted -> expired (>24h) and tampered URLs rejected with HTTP 403 Forbidden.

---

## 3. Complete Feature Inventory & Coverage Matrix

| # | Feature Name | Milestone | Tier 1 Tests | Tier 2 Tests | Tier 3 (Cross) | Tier 4 (Scenario) | Total Tests |
|---|--------------|:---------:|:------------:|:------------:|:--------------:|:-----------------:|:-----------:|
| 1 | Audio Extraction & STT | M1 | 5 | 5 | ✓ | ✓ | 10+ |
| 2 | 5-Language Contextual Translation | M1 | 5 | 5 | ✓ | ✓ | 10+ |
| 3 | Synchronized Subtitle Generator (SRT/VTT) | M1 | 5 | 5 | ✓ | ✓ | 10+ |
| 4 | Native APAC Voice Synthesis & Audio Sync | M1 | 5 | 5 | ✓ | ✓ | 10+ |
| 5 | Smart Localization Router | M1 | 5 | 5 | - | - | 10 |
| 6 | APAC Voice Presets Expansion | M1 | 5 | 5 | - | - | 10 |
| 7 | Bilingual Locale Files & Routing | M1 | 5 | 5 | - | - | 10 |
| 8 | D1 `creator_templates` Registry | M2 | 5 | 5 | ✓ | ✓ | 10+ |
| 9 | Template Review & Quality Rating FSM | M2 | 5 | 5 | ✓ | ✓ | 10+ |
| 10 | 70/30 Royalty Revenue Split Math | M2 | 5 | 5 | ✓ | ✓ | 10+ |
| 11 | OCC CAS Creator Earnings Accrual | M2 | 5 | 5 | ✓ | ✓ | 10+ |
| 12 | Anti-Fraud Lineage Traversal | M2 | 5 | 5 | ✓ | ✓ | 10+ |
| 13 | Bilingual Creator Studio Portal | M2 | 5 | 5 | - | ✓ | 10+ |
| 14 | Multi-Rail Creator Payouts (USDT / VietQR) | M2 | 5 | 5 | ✓ | ✓ | 10+ |
| 15 | D1 Migration `0291_creator_templates` | M2 | 5 | 5 | - | - | 10 |
| 16 | Omnichannel Video Publishing Adapter Mesh | M3 | 5 | 5 | ✓ | ✓ | 10+ |
| 17 | OAuth2 Platform Token Lifecycle & Refresh | M3 | 5 | 5 | - | - | 10 |
| 18 | APAC Peak-Time Scheduling Optimizer | M3 | 5 | 5 | ✓ | ✓ | 10+ |
| 19 | Multi-Channel Anti-Collision & Stagger | M3 | 5 | 5 | ✓ | ✓ | 10+ |
| 20 | Account Protection Cooldown & Deferral | M3 | 5 | 5 | ✓ | - | 10+ |
| 21 | Viral Metadata Generator | M3 | 5 | 5 | ✓ | ✓ | 10+ |
| 22 | Tracked Funnel & Telegram Bot Deep Linking | M3 | 5 | 5 | ✓ | ✓ | 10+ |
| 23 | Adaptive Bitrate HLS Stream Generator | M4 | 5 | 5 | ✓ | ✓ | 10+ |
| 24 | Global Edge CDN Caching Mesh | M4 | 5 | 5 | - | - | 10 |
| 25 | Dynamic Forensic Watermarking | M4 | 5 | 5 | ✓ | ✓ | 10+ |
| 26 | 24-Hour HMAC Signed Download URLs | M4 | 5 | 5 | ✓ | ✓ | 10+ |
| 27 | Adaptive Video Player Client Component | M4 | 5 | 5 | - | - | 10 |
| 28 | 4-Layer Clean Architecture Enforcement | M5 | 5 | 5 | - | - | 10 |
| 29 | TypeScript Strict Compilation Gate | M5 | 5 | 5 | - | - | 10 |
| 30 | Production Bit-for-Bit SHA Parity | M5 | 5 | 5 | - | - | 10 |
| 31 | Sophia Doctor 11/11 Diagnostic Health | M5 | 5 | 5 | - | - | 10 |
| **Total** | **31 Features** | | **155** | **155** | **8** | **5** | **323** |

---

## 4. Test Directory Layout

```
tests/e2e/
├── harness/
│   ├── e2e-test-harness.ts              # D1 SQLite shim, models, crypto & event bus
│   ├── mock-db-schema.ts                # D1 schema for templates, ledger, publishing_jobs, etc.
│   └── test-fixtures.ts                 # Transcripts, presets, and sample payloads
├── tier1-feature-coverage/
│   ├── r1-dubbing-localization.test.ts  # Features 1–7 nominal coverage (35 tests)
│   ├── r2-creator-marketplace.test.ts   # Features 8–15 nominal coverage (40 tests)
│   ├── r3-syndication-scheduler.test.ts # Features 16–22 nominal coverage (35 tests)
│   ├── r4-edge-cdn-hls.test.ts          # Features 23–27 nominal coverage (25 tests)
│   └── r5-quality-architecture.test.ts  # Features 28–31 nominal coverage (20 tests)
├── tier2-boundary-corner/
│   ├── r1-dubbing-boundaries.test.ts    # Features 1–7 edge cases & boundaries (35 tests)
│   ├── r2-marketplace-boundaries.test.ts# Features 8–15 edge cases & boundaries (40 tests)
│   ├── r3-syndication-boundaries.test.ts# Features 16–22 edge cases & boundaries (35 tests)
│   ├── r4-streaming-boundaries.test.ts  # Features 23–27 edge cases & boundaries (25 tests)
│   └── r5-quality-boundaries.test.ts    # Features 28–31 edge cases & boundaries (20 tests)
├── tier3-cross-feature/
│   └── cross-feature-combinations.test.ts # 8 pairwise state/data sharing tests (8 tests)
├── tier4-real-world/
│   └── real-world-scenarios.test.ts       # 5 complex multi-actor end-to-end workflows (5 tests)
└── runner.mjs                             # Standalone executable runner script
```

---

## 5. Verification Commands

### 1. Execute Full E2E Test Suite (323 tests)
```bash
# Using the standalone runner script:
node tests/e2e/runner.mjs

# Or directly via Vitest:
/opt/homebrew/bin/node ./apps/sophia-ai-factory/node_modules/vitest/vitest.mjs run --root . --exclude "**/.stryker-tmp/**" --exclude "**/.claude/**" --exclude "apps/**" tests/e2e/
```

### 2. Execute by Tier
```bash
# Tier 1 only (155 tests)
node tests/e2e/runner.mjs --tier1

# Tier 2 only (155 tests)
node tests/e2e/runner.mjs --tier2

# Tier 3 only (8 tests)
node tests/e2e/runner.mjs --tier3

# Tier 4 only (5 scenarios)
node tests/e2e/runner.mjs --tier4
```

### 3. Run Quality Gates
```bash
# Check 4-Layer Architecture compliance (0 violations)
bash scripts/check-layer-boundaries.sh

# Run Sophia Doctor Diagnostic Health (11/11 GREEN)
/opt/homebrew/bin/node apps/sophia-ai-factory/scripts/sophia-doctor.mjs
```
