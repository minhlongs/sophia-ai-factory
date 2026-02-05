# Project Changelog

## [Unreleased]

## v1.7.0 - Binh Pháp Full Automation
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
