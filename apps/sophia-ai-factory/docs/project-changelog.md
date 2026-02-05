# Project Changelog

## [Unreleased]

### Added
- **User Settings & Profile Management**:
  - Added `/settings` page for managing user profile, preferences, and API keys.
  - Implemented secure API key storage using AES-256-GCM encryption (OpenAI, Anthropic, ElevenLabs).
  - Added Theme Switcher (Light/Dark/System) using `next-themes`.
  - Added Notification Preferences (Email & Telegram).
- **Production Verification Dashboard**:
  - Added `/api/health` endpoint for system health checks.
  - Added `HealthIndicator` component to the dashboard sidebar.
  - Added System Health page (`/dashboard/system-health`) for detailed service status monitoring.
  - Implemented checks for Supabase, Inngest, and external API configurations (OpenRouter, ElevenLabs, HeyGen, Telegram).
