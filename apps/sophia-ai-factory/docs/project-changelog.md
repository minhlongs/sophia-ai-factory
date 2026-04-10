# Project Changelog

## [Unreleased] - v1.9.0

### v1.9.0 - Polar→NOWPayments Migration Complete (2026-04-10)
- **Breaking Change**: Removed Polar.sh payment provider entirely. All payment processing now via NOWPayments (USDT TRC20).
- **Code Removed** (35+ files):
  - All Polar SDK client code, config, and types
  - Polar webhook handler (`/api/webhooks/polar`)
  - Stripe integration (metered billing, invoices, payment-status)
  - Daily usage export cron jobs
  - Admin billing reconciliation routes and quota enforcement
- **Code Added**:
  - NOWPayments IPN webhook handler (`/api/webhooks/nowpayments`)
  - HMAC-SHA512 signature verification for webhooks
  - Order ID format: `sophia_{orgId}_{timestamp}` for idempotency tracking
  - Tier-to-invoice-ID mapping in `nowpayments-client.ts`
- **Updated Components**:
  - Middleware whitelists: `/api/webhooks/polar` → `/api/webhooks/nowpayments`
  - Subscription gate, RaaS gate, agency isolation validators
  - Payment service abstraction layer (mock + real implementations)
  - Billing types to match NOWPayments IPN payload structure
- **Backup Provider**: PayOS (payos.vn) configured for Vietnam domestic payments
- **Security**: All Polar credentials removed from environment. NOWPayments API key + IPN secret only.
- **Test Impact**: 47 tests removed (Polar-specific), 52 new NOWPayments webhook tests added

### v1.8.0 - Usage Metering & License Gating (2026-03-07)
- **Feature:** Usage Metering Aggregator with time-windowed summaries
- **API Endpoints:**
  - `/api/usage/summary` - Get aggregated usage by period (hourly/daily breakdown)
  - `/api/usage/export` - Export usage data (CSV/JSON with 90-day validation)
  - `/api/v1/usage` (POST) - Batch ingestion endpoint (up to 1000 records/batch)
- **Architecture:**
  - Clean separation: Tracker (raw) → Aggregator (analytics) → Export (billing)
  - License-based quota enforcement (BASIC/PREMIUM/ENTERPRISE/MASTER)
  - CSV injection protection via `escapeCsvField`
- **Quotas by Tier:**
  - BASIC: 100 daily / 20 hourly / 500 requests / 2,000 monthly credits
  - PREMIUM: 500 daily / 100 hourly / 2,500 requests / 10,000 monthly credits
  - ENTERPRISE: 2,000 daily / 500 hourly / 10,000 requests / 50,000 monthly credits
  - MASTER: 10,000 daily / 2,000 hourly / 50,000 requests / 200,000 monthly credits
- **Batch Ingestion:**
  - Post records to `/api/v1/usage` with Zod validation
  - Validates timestamp (within 30 days), service enum, feature_key format
  - Returns per-record results with success/failure + quota remaining
- **Test Coverage:** 462 tests passing including aggregator and batch ingestion API

## v1.7.0 - Binh Pháp Full Automation (2026-02-05)
- **Architecture**: Implemented Service Factory Pattern (`src/lib/services`) decoupling business logic from external APIs.
- **DevEx**: Added **Mock Mode** (`NEXT_PUBLIC_MOCK_AI_SERVICES=true`) for zero-cost, offline development.
- **CI/CD**: Full GitHub Actions pipeline with Lint, Type-Check, Unit Tests, and Playwright E2E tests.
- **Quality**: Enhanced `verify.sh` with security audit and build verification.
- **Production**: Added `infra-sync.sh` for idempotent infrastructure setup and `smoke-test.ts` for live verification.

## v1.6.0 - Production Readiness
- **Feature**: Comprehensive CLI Production Setup Wizard (`npm run setup:production`).
- **Automation**:
  - **Polar.sh**: Automated product provisioning and webhook setup.
  - **Supabase**: Connection verification and table existence checks.
  - **Telegram**: Bot token validation and automated webhook configuration.
- **DX**: Interactive terminal UI for environment variable management and system verification.
- **Reporting**: Generates detailed markdown reports on system health status.

## v1.5.0 - HeyGen Integration
- **Feature**: Full integration with HeyGen API for high-quality avatar videos.
- **Architecture**: Direct server-side API proxy for secure key handling.
- **UI**: Interactive Video Preview component with status tracking (Draft, Queued, Processing, Completed).
- **Testing**: Complete test coverage for API client and UI components (29 tests passed).
- **DX**: Added `src/lib/heygen` client library with type-safe interfaces.

## v1.4.0 - Tier Validation System
- **Feature**: Comprehensive Tier Validation System for feature gating.
- **Enforcement**:
  - **Tier Guard Middleware**: Protects API routes based on user subscription level.
  - **Limit Checking**: Enforces limits on YouTube channels (1/3/Unlimited) and Templates (5/Unlimited/Unlimited).
  - **API Gating**: Restricts access to advanced endpoints for lower tiers.
- **UI Components**:
  - **Upgrade Banner**: Context-aware prompts to upgrade when hitting limits.
  - **Feature Locks**: Visual indicators for locked premium features (Affiliate Engine, ROI Calculator).
- **Security**: Server-side validation ensures client-side bypasses are impossible.

## v1.3.0 - Mobile Command Center
- **Feature**: Full Telegram Bot integration for remote campaign management.
- **Commands**:
  - `/start`: Bot initialization and welcome.
  - `/email`: Secure account linking via email verification.
  - `/campaign`: Instant campaign creation from mobile.
  - `/status`: Real-time progress monitoring.
  - `/results`: Access to completed video assets.
- **Security**: Webhook secret validation and role-based access control.
- **Infrastructure**: Integrated with Inngest event bus for asynchronous processing.

## v1.2.0 - Monetization Release
- **Feature**: Full payment infrastructure integration with Polar.
- **Feature**: Automated provisioning of pricing tiers.
- **Security**: Webhook signature verification for payment events.
- **UX**: Seamless checkout flow from pricing page.

## v1.1.0 - User Settings & Health Monitoring
- **Feature**: Complete User Settings implementation with secure API key storage.
- **Feature**: System Health Dashboard for real-time monitoring of infrastructure.
- **Security**: AES-256-GCM encryption for all stored API keys.
- **UX**: Theme management (Light/Dark mode) persisted to user profile.

## v1.0.2 - Bootstrap Review Complete
- **Status**: Validated core pipeline functionality.
- **Docs**: Finalized roadmap and architecture documentation.
- **Testing**: Confirmed test suite coverage for validation and webhooks.

## v1.0.1 - Post-Bootstrap Refinement
- **Refactor**: Modularized Setup Wizard into step components for better maintainability.
- **Security**: Added production guard for `.env.local` writing in API routes.
- **Testing**: Added unit tests for validation services and integration tests for Polar webhooks.

## v1.0.0 - Turnkey Release
- **Feature**: Added `/setup-wizard` for automated onboarding.
- **Feature**: Implemented API Key validation logic.
- **Feature**: Added `setup.sh` interactive installer.
- **Docs**: Comprehensive documentation update (Deployment Guide, PDR).

## v0.5.0 - Alpha
- Initial project scaffold.
- Basic Dashboard UI.
- Mock data integration.
