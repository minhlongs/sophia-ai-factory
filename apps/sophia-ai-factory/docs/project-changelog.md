# Project Changelog

## [Unreleased]

### Added
- **User Settings & Profile Management**:
  - Added `/dashboard/settings` page for managing user profile, preferences, and API keys (migrated from `/settings`).
  - Implemented secure API key storage using AES-256-GCM encryption (OpenAI, Anthropic, ElevenLabs).
  - Added Theme Switcher (Light/Dark/System) using `next-themes`.
  - Added Notification Preferences (Email & Telegram).
  - Added Read-only Email display.
- **Production Verification Dashboard**:
  - Added `/api/health` endpoint for system health checks.
  - Added `HealthIndicator` component to the dashboard sidebar.
  - Added System Health page (`/dashboard/system-health`) for detailed service status monitoring.
  - Implemented checks for Supabase, Inngest, and external API configurations (OpenRouter, ElevenLabs, HeyGen, Telegram).

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
