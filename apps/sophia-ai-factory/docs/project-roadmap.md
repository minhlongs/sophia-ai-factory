# Project Roadmap

**Project Name:** Sophia AI Video Factory
**Current Version:** 1.0.0 (Turnkey Release)
**Last Updated:** 2026-02-04

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

### 🚧 Phase 3: Core Pipeline (In Progress)
**Goal:** Wire up the "Brain" to the "Body" (Frontend to n8n Automation).
- [ ] **Script Generation**:
  - [ ] Connect `Generate Script` button to `/api/generate-script`.
  - [ ] Poll Airtable for script status updates.
  - [ ] Display generated scripts in Dashboard.
- [ ] **Video Rendering**:
  - [ ] Connect `Render Video` button to `/api/render-video`.
  - [ ] Handle async status (Processing -> Completed).
  - [ ] Video player integration in Dashboard.
- [ ] **Workflow Polishing**:
  - [ ] Refine n8n prompts for better script quality.
  - [ ] Add error handling for automation failures.

### 🔮 Phase 4: Scaling & SaaS (Future)
**Goal:** Multi-user support and advanced features.
- [ ] **Authentication**: Move from Basic Auth to NextAuth/Clerk.
- [ ] **Multi-Tenancy**: Support multiple user accounts per deployment.
- [ ] **Advanced Affiliate**: Real-time scraping of Amazon/ClickBank.
- [ ] **Social Publishing**: Auto-upload to YouTube/TikTok via API.
- [ ] **Analytics**: Deep dive into video performance metrics.

## Changelog

### v1.0.0 - Turnkey Release
- **Feature**: Added `/setup-wizard` for automated onboarding.
- **Feature**: Implemented API Key validation logic.
- **Feature**: Added `setup.sh` interactive installer.
- **Docs**: Comprehensive documentation update (Deployment Guide, PDR).

### v0.5.0 - Alpha
- Initial project scaffold.
- Basic Dashboard UI.
- Mock data integration.
