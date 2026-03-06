# Project Roadmap

**Project Name:** Sophia AI Video Factory
**Current Version:** 1.8.0 (Usage Metering & License Gating)
**Last Updated:** 2026-03-07

## 📅 Roadmap Overview

### ✅ Phase 1: Foundation (Completed)
**Goal:** Establish the core architecture and UI framework.
- [x] Next.js 16 App Router setup with TypeScript.
- [x] Tailwind CSS 4 & Geist UI implementation.
- [x] Core component library (`src/app/components/ui`).
- [x] Basic routing and layouts.

### ✅ Phase 2: Turnkey Wizard (Completed - Current Release)
**Goal:** Enable "Zero-Code" onboarding for non-technical users.
- [x] **Setup Wizard**: Interactive 4-step configuration flow.
- [x] **Middleware**: Auto-redirect for unconfigured instances.
- [x] **Verification**: Real-time validation of OpenRouter, ElevenLabs, D-ID keys.
- [x] **Airtable Integration**: Template copying and connection verification.
- [x] **CLI Tools**: `setup.sh` and `verify.sh` for easy installation.
- [x] **Affiliate Engine**: Product discovery UI with JSON data source.

### ✅ Phase 3: Core Pipeline (Completed)
**Goal:** Wire up the "Brain" to the "Body" (Frontend to n8n Automation).
- [x] **Dashboard UI**:
  - [x] Project list view with status badges.
  - [x] Create Project form (Topic & Audience).
  - [x] Real-time status polling.
- [x] **User Settings & Security**:
  - [x] User Profile Management (`/dashboard/settings`).
  - [x] Secure Encrypted API Key Storage (AES-256-GCM).
  - [x] Theme Management (Dark/Light Mode).
  - [x] Notification Preferences (Email/Telegram).
- [x] **Script Generation**:
  - [x] Connect `Generate Script` button to `/api/generate-script` (via Server Action).
  - [x] Poll Airtable for script status updates (Implemented in UI).
  - [x] Display generated scripts in Dashboard.
- [x] **Video Rendering**:
  - [x] Connect `Render Video` button to `/api/render-video` (via Server Action).
  - [x] Handle async status (Processing -> Completed) (Implemented in UI).
  - [x] Video player integration in Dashboard.
- [x] **Workflow Polishing**:
  - [x] Configure n8n workflows (External).
  - [x] Refine n8n prompts for better script quality.
  - [x] Add error handling for automation failures.
  - [x] **Production Monitoring**:
    - [x] System Health Dashboard (`/dashboard/system-health`).
    - [x] Health Check API (`/api/health`).

### ✅ Phase 4: Monetization (Completed)
**Goal:** Implement payment processing and tier-based access control.
- [x] **Polar Integration**:
  - [x] SDK setup and configuration.
  - [x] Product provisioning script (`scripts/setup-polar-products.ts`).
  - [x] Checkout session API (`/api/checkout`).
- [x] **Tiered Pricing**:
  - [x] 3-Tier Model: Starter ($1,200), Growth ($2,000), Premium ($3,000).
  - [x] Feature gating logic in `src/config/tiers.ts`.
- [x] **Tier Enforcement System**:
  - [x] **Tier Guard Middleware**: Server-side checks for API routes.
  - [x] **UI Gating**: Upgrade banners and disabled states for locked features.
  - [x] **Limit Validation**: Enforcement of channel and template limits.
- [x] **Webhooks**:
  - [x] Secure webhook handler with signature verification.
  - [x] Automatic subscription status updates in Supabase.
- [x] **UI Integration**:
  - [x] Pricing page with "Buy Now" integration.
  - [x] Loading states and error handling during checkout.

### ✅ Phase 5: Mobile Command Center (Completed)
**Goal:** Enable remote campaign management via Telegram.
- [x] **Bot Infrastructure**:
  - [x] Webhook handler with security validation (`X-Telegram-Bot-Api-Secret-Token`).
  - [x] Bi-directional messaging service.
- [x] **User Linking**:
  - [x] `/email` command to link Telegram ID to Supabase User securely.
- [x] **Campaign Management**:
  - [x] `/campaign <topic>` to trigger new video generation.
  - [x] `/status` to poll active job progress.
  - [x] `/results` to retrieve completed video links.
- [x] **Integration**:
  - [x] Connected to Inngest event bus (`campaign.created`).
  - [x] Real-time updates from core pipeline.

### ✅ Phase 6: Enterprise Video Engine (Completed)
**Goal:** High-fidelity AI video generation with HeyGen.
- [x] **Direct API Integration**:
  - [x] Robust HeyGen Client (`src/lib/heygen`).
  - [x] Server-side API Routes (`/api/heygen/*`) for secure communication.
- [x] **Asset Management**:
  - [x] Avatar Library browser.
  - [x] Voice Selection interface.
- [x] **Video Generation Pipeline**:
  - [x] Direct video creation job submission.
  - [x] Real-time status polling mechanism.
  - [x] Video Preview UI with playback and download.
- [x] **Testing & Quality**:
  - [x] Comprehensive unit and integration test suite (100% pass rate).

### ✅ Phase 7: Production Readiness (Completed)
**Goal:** Streamlined deployment and verification for production environments.
- [x] **Production Setup Wizard**:
  - [x] CLI-based interactive wizard (`npm run setup:production`).
  - [x] Automated environment variable verification.
  - [x] **Polar.sh Integration**: Product synchronization and connection check.
  - [x] **Supabase Integration**: Connection test and table verification.
  - [x] **Telegram Integration**: Bot verification and webhook configuration.
- [x] **E2E Verification**:
  - [x] Final system health check report generation.

### ✅ Phase 8: Binh Pháp Automation (Completed)
**Goal:** Achieve "Click-to-Ship" maturity with zero-touch CI/CD and Mock Mode.
- [x] **Mock Infrastructure (Zero-Cost Dev)**:
  - [x] Service Factory Pattern (`src/lib/services`) for DI.
  - [x] `MockHeyGenClient` & `MockPaymentService` implementation.
  - [x] `npm run dev:mock` for offline development.
- [x] **CI/CD Pipeline**:
  - [x] GitHub Actions with Quality, Test, and Security gates.
  - [x] Playwright E2E tests running against Mock Services.
  - [x] Vercel Preview Deployments on PRs.
- [x] **Deployment Automation**:
  - [x] Idempotent infrastructure sync (`scripts/sync-polar.ts`).
  - [x] Automated Vercel project setup (`setup-vercel.sh`).
- [x] **Green Gate Verification**:
  - [x] Post-deploy smoke tests (`scripts/smoke-test.ts`).
  - [x] Automated rollback triggers.

### ✅ Phase 9: Usage Metering & License Gating (Completed)
**Goal:** Usage tracking, quota enforcement, and analytics for license-based pricing.
- [x] **Usage Aggregator**: Core aggregation logic with hourly/daily windows
- [x] **Quota Enforcement**: License-based limits by tier (BASIC/PREMIUM/ENTERPRISE/MASTER)
- [x] **API Endpoints**: `/api/usage/summary` and `/api/usage/export`
- [x] **Export Utilities**: CSV export with injection protection, 90-day range validation
- [x] **Type Safety**: Full TypeScript type definitions for metering system
- [x] **Batch Ingestion**: `/api/v1/usage` POST endpoint (up to 1000 records/batch)
- [x] **Validation**: Zod schema validation for timestamp, service, feature_key
- [x] **Test Coverage**: 462 tests passing (aggregator + batch ingestion API)

### 🔮 Phase 10: Scaling & SaaS (Future)
**Goal:** Multi-user support and advanced features.
- [ ] **Authentication**: Move from Basic Auth to NextAuth/Clerk.
- [ ] **Multi-Tenancy**: Support multiple user accounts per deployment.
- [ ] **Advanced Affiliate**: Real-time scraping of Amazon/ClickBank.
- [ ] **Social Publishing**: Auto-upload to YouTube/TikTok via API.
- [ ] **Analytics**: Deep dive into video performance metrics.

## Changelog

### v1.7.0 - Binh Pháp Full Automation
- **Architecture**: Implemented Service Factory Pattern (`src/lib/services`) decoupling business logic from external APIs.
- **DevEx**: Added **Mock Mode** (`NEXT_PUBLIC_MOCK_AI_SERVICES=true`) for zero-cost, offline development.
- **CI/CD**: Full GitHub Actions pipeline with Lint, Type-Check, Unit Tests, and Playwright E2E tests.
- **Production**: Added `infra-sync.sh` for idempotent infrastructure setup and `smoke-test.ts` for live verification.

### v1.6.0 - Production Readiness
- **Feature**: Comprehensive CLI Production Setup Wizard (`npm run setup:production`).
- **Automation**: Polar.sh, Supabase, and Telegram automated configuration.
- **Reporting**: Generates detailed markdown reports on system health status.

### v1.5.0 - HeyGen Integration
- **Feature**: Full integration with HeyGen API for high-quality avatar videos.
- **Architecture**: Direct server-side API proxy for secure key handling.
- **UI**: Interactive Video Preview component with status tracking.
- **Testing**: Complete test coverage for API client and UI components.

### v1.4.0 - Tier Validation System
- **Feature**: Complete User Settings implementation with secure API key storage.
- **Feature**: System Health Dashboard for real-time monitoring.
- **Security**: AES-256-GCM encryption for API keys.
- **UX**: Theme management and Notification preferences.

### v1.0.2 - Bootstrap Review Complete
- **Status**: Validated core pipeline functionality.
- **Docs**: Finalized roadmap and architecture documentation.
- **Testing**: Confirmed test suite coverage for validation and webhooks.

### v1.0.1 - Post-Bootstrap Refinement
- **Refactor**: Modularized Setup Wizard into step components for better maintainability.
- **Security**: Added production guard for `.env.local` writing in API routes.
- **Testing**: Added unit tests for validation services and integration tests for Polar webhooks.

### v1.0.0 - Turnkey Release
- **Feature**: Added `/setup-wizard` for automated onboarding.
- **Feature**: Implemented API Key validation logic.
- **Feature**: Added `setup.sh` interactive installer.
- **Docs**: Comprehensive documentation update (Deployment Guide, PDR).

### v0.5.0 - Alpha
- Initial project scaffold.
- Basic Dashboard UI.
- Mock data integration.
