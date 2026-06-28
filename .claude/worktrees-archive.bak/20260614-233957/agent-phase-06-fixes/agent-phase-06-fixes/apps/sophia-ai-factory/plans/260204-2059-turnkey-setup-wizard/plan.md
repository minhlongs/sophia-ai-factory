---
title: "Turnkey Setup Wizard Implementation"
description: "Implementation of a zero-config setup wizard, validation scripts, and pre-configuration for Sophia AI Factory."
status: completed
completed: 2026-02-04
priority: P1
effort: 3d
branch: master
tags: [setup, wizard, ux, automation]
created: 2026-02-04
---

## Overview
This plan implements a "Turnkey" experience for Sophia AI Factory. The goal is to allow a non-technical user to configure the application purely via a UI Wizard or a simple terminal script, validating all API keys in real-time.

## Phases

### Phase 1: Setup Wizard UI
**Goal**: Create a user-friendly, 4-step configuration interface (`/setup-wizard`) that guides the user through connectivity checks, API key entry, and validation.
- [x] Implement Stepper UI component
- [x] Create System Check step
- [x] Create API Key Entry step with "Where to find?" help
- [x] Create Finalize/Health Check step
- [x] Add Middleware redirect for unconfigured state

### Phase 2: One-Click Scripts
**Goal**: Provide terminal-based alternatives for setup and verification (`scripts/setup.sh`).
- [x] Create `setup.sh` interactive script
- [x] Create `verify.sh` for system health
- [x] Integrate with `npm run setup`

### Phase 3: Validation Logic
**Goal**: Backend API endpoints to securely validate third-party credentials without exposing them to the client.
- [x] Implement `/api/setup/verify` endpoint
- [x] Implement Service Validators (OpenRouter, ElevenLabs, D-ID, Airtable)
- [x] Implement Config persistence logic (local file or secure storage)

### Phase 4: Pre-configuration
**Goal**: Ensure all non-secret settings are pre-baked into the app to minimize user input.
- [x] Define Airtable Schema JSON
- [x] Auto-create/Validate Airtable structure
- [x] Bundle n8n workflow JSONs
- [x] Set default `config.json` values

### Phase 5: Handoff & Documentation
**Goal**: Clean up and simplify documentation for the end user.
- [x] Update `HANDOFF.md` (Zero-tech version)
- [x] Simplify `README.md`
- [x] Final "Clean" verification

## Unresolved Questions
- **Persistence**: For Vercel deployments, we cannot write to the filesystem. The wizard should offer a "Copy to Clipboard" or "Download .env" fallback for cloud deployment.
- **Security**: Access to `/setup-wizard` must be restricted after initial configuration.

## Completion Summary
All phases of the Turnkey Setup Wizard have been successfully implemented.
- **UI**: A 4-step wizard at `/setup-wizard` guides users through configuration.
- **Scripts**: `scripts/setup.sh` and `scripts/verify.sh` provide terminal-based setup.
- **Validation**: Secure API endpoints ensure keys (OpenRouter, ElevenLabs, D-ID, Airtable) are valid before saving.
- **Pre-config**: Airtable schemas and n8n workflows are bundled.
- **Documentation**: `HANDOFF.md` updated for end-users.
