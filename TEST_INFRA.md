# TEST_INFRA — Enterprise Scale Engine (Phase 18–19 Scale Ready)

## 1. Test Philosophy & Architecture

The Enterprise Scale Engine test suite employs an **opaque-box, contract-driven, deterministic verification methodology** derived strictly from `ORIGINAL_REQUEST.md` (§R1–R4) and `PROJECT.md`.

- **Decoupling**: Tests verify observable inputs, outputs, database mutations, and protocol responses rather than internal implementation details.
- **In-Memory Cloudflare D1 Simulation**: Built upon `src/__tests__/integration/shared-d1-shim.ts` using Node.js native `DatabaseSync` (`node:sqlite`). Zero external network dependencies, zero shared test state, and sub-millisecond execution times.
- **Strict 4-Layer Boundary Adherence**: Import paths respect `seed` -> `tree` -> `forest` -> `land`. Zero `:any` types.
- **Deterministic Cryptography & Time**: Web Crypto timing-safe HMAC-SHA256 signatures, CSPRNG token generators, and millisecond-accurate timestamp drift assertions.

---

## 2. 4-Tier Testing Methodology

The test suite is structured into four orthogonal verification tiers:

### Tier 1 — Feature Coverage ($\ge 5$ tests per feature)
Verifies nominal, happy-path execution of every functional requirement:
- Custom domain registration, CNAME formatting, and Cloudflare for SaaS record tracking.
- Verification lifecycle state machine transitions (`pending_validation` -> `active`).
- Dynamic theme CSS variable extraction (`--primary-color`, logos, portal branding).
- White-label transactional email rendering with branded headers, footers, and signatures.
- Organization creation, metadata updates, and seat quotas across 4 tiers (Free: 1, Starter: 1, Pro: 5, Master: 999).
- 256-bit cryptographic single-use invitation token generation, 7-day TTL, and SHA-256 storage hash.
- Invitation verification, atomic token consumption, and member role assignment.
- 5-tier RBAC permission evaluation (`owner`, `admin`, `creator`, `billing_manager`, `viewer`) across 5 typed permissions (`canCreateMissions`, `canManageBilling`, `canInviteMembers`, `canPublishVideos`, `canConfigureWebhooks`).
- Org context switching and tenant isolation enforcement (`assertTenantScope`).
- Unified Executive BI aggregation across MRR, video throughput, viral engagement, and affiliate conversion ROI.
- Scheduled executive digest generation for Resend email and Telegram bot (MarkdownV2 escaped, <4096 chars).
- Streaming multi-format export API (RFC-4180 CSV escaping and structured JSON streaming).
- Outbound webhook subscription manager CRUD and event filtering.
- Timing-safe HMAC-SHA256 signature generator (`X-Sophia-Signature: t=<timestamp>,v1=<hex>`).
- Resilient delivery bus with exponential backoff and jitter schedule (`30s, 2m, 10m, 1h, 6h`).
- Dead Letter Queue (DLQ) state machine (transition after 5 attempts) and manual replay API.

### Tier 2 — Boundary, Corner & Adversarial Cases ($\ge 5$ tests per feature area)
Evaluates extreme inputs, edge conditions, security violations, and failure modes:
- Expired invitation tokens (>7 days TTL) and double-consumption race conditions.
- Seat quota exhaustion and quota enforcement re-check during concurrent acceptance.
- Unauthorized role attempts on protected operations (e.g. `creator` attempting billing, `viewer` attempting webhook mutations).
- Hostname collision, invalid domain syntax, IDN homograph spoofing, and malicious CNAME targets.
- Transient HTTP 5xx errors, webhook timeouts (>10s), network failure simulation, and max retry DLQ exhaustion.
- Malformed HMAC headers, stale timestamps (>300s clock drift), and timing attack resistance.
- RFC-4180 special character escaping (commas, double quotes, CRLF newlines, unicode, null bytes).
- Zero-division guards in BI metrics (0 revenue, 0 impressions, empty date ranges).

### Tier 3 — Pairwise & Cross-Feature Combinations
Verifies multi-feature interactions, concurrency, and cross-boundary invariants:
- Multi-tenant isolation during concurrent webhook deliveries and simultaneous BI aggregations.
- Organization context switching dynamically altering custom domain branding and theme CSS variables.
- RBAC permission enforcement gating webhook subscription CRUD and custom domain registrations.
- White-label email templating using live organization branding settings during automated digest delivery.

### Tier 4 — Real-World Application Scenarios
Simulates realistic end-to-end user workflows and operational journeys:
1. **Agency White-Label Onboarding**: Agency registers custom domain `video.agency.com`, configures branding colors & logo, triggers verification, and sends branded transactional notification.
2. **Enterprise Organization & RBAC Lifecycle**: Master tier owner creates organization, invites admin, creator, billing manager, and viewer; verifies cryptographic token links; accepts invites; confirms granular permission boundaries.
3. **Executive BI & Audit Reporting**: Monthly closeout flow generating unified BI metrics, formatting executive digest for Telegram Bot & Email, and streaming RFC-4180 CSV export.
4. **Resilient Outbound Webhooks & Recovery**: Developer registers webhook endpoint for `video.rendered`, triggers dispatch, simulates recipient server failures through 5 retries, verifies DLQ logging, and executes manual replay.

---

## 3. Feature Inventory & Coverage Matrix

| # | Feature Area | Milestone | Source Requirement | Tier 1 Tests | Tier 2 Tests | Tier 3 (Pairwise) | Tier 4 (Scenarios) |
|---|--------------|-----------|--------------------|:------------:|:------------:|:-----------------:|:------------------:|
| 1 | Custom Domains & Verification | M1 | ORIGINAL_REQUEST §R1 | 5 | 5 | ✓ | ✓ |
| 2 | Hostname Routing & Resolution | M1 | ORIGINAL_REQUEST §R1 | 5 | 5 | ✓ | ✓ |
| 3 | Dynamic Theme & CSS Injection | M1 | ORIGINAL_REQUEST §R1 | 5 | 5 | ✓ | ✓ |
| 4 | White-Label Email Templating | M1 | ORIGINAL_REQUEST §R1 | 5 | 5 | ✓ | ✓ |
| 5 | Org Creation & Seat Quotas | M2 | ORIGINAL_REQUEST §R2 | 5 | 5 | ✓ | ✓ |
| 6 | Crypto Invite Tokens & Acceptance | M2 | ORIGINAL_REQUEST §R2 | 5 | 5 | ✓ | ✓ |
| 7 | 5-Tier RBAC Permission Matrix | M2 | ORIGINAL_REQUEST §R2 | 5 | 5 | ✓ | ✓ |
| 8 | Org Context Switching & Tenant Guard | M2 | ORIGINAL_REQUEST §R2 | 5 | 5 | ✓ | ✓ |
| 9 | Unified BI Metrics Aggregator | M3 | ORIGINAL_REQUEST §R3 | 5 | 5 | ✓ | ✓ |
| 10 | Executive Digest Dispatcher | M3 | ORIGINAL_REQUEST §R3 | 5 | 5 | ✓ | ✓ |
| 11 | Streaming Multi-Format Export API | M3 | ORIGINAL_REQUEST §R3 | 5 | 5 | ✓ | ✓ |
| 12 | Webhook Subscription Management | M4 | ORIGINAL_REQUEST §R4 | 5 | 5 | ✓ | ✓ |
| 13 | Timing-Safe HMAC Signatures | M4 | ORIGINAL_REQUEST §R4 | 5 | 5 | ✓ | ✓ |
| 14 | Resilient Retry Bus & Backoff | M4 | ORIGINAL_REQUEST §R4 | 5 | 5 | ✓ | ✓ |
| 15 | DLQ State Machine & Manual Replay | M4 | ORIGINAL_REQUEST §R4 | 5 | 5 | ✓ | ✓ |

---

## 4. Test Directory Layout

```
apps/sophia-ai-factory/src/__tests__/e2e/enterprise/
├── enterprise-test-harness.ts              # D1 SQLite shim, contract models & crypto utilities
├── custom-domains-whitelabel.e2e.test.ts   # Custom domains, SSL/CNAME lifecycle, theme CSS, email branding
├── organizations-rbac.e2e.test.ts          # Org lifecycle, seat quotas, crypto invite tokens, 5-tier RBAC, tenant guard
├── executive-bi.e2e.test.ts                # MRR, throughput, engagement, ROI aggregations, digests, streaming exports
└── outbound-webhooks.e2e.test.ts           # Webhook subscriptions, HMAC-SHA256, exponential backoff, DLQ & replay
```

---

## 5. Verification Commands

```bash
cd apps/sophia-ai-factory

# Run the complete Enterprise Scale Engine E2E test suite
PATH="/opt/homebrew/bin:$PATH" npx vitest run src/__tests__/e2e/enterprise/

# Run TypeScript typecheck
PATH="/opt/homebrew/bin:$PATH" npm run type-check

# Verify 4-layer architecture compliance
bash scripts/check-layer-boundaries.sh
```
