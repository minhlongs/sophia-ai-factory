# Codebase Summary

**Last Updated:** 2026-02-05
**Version:** 1.0.2 (Bootstrap Review Complete)

## Project Structure Overview

Sophia AI Video Factory is a Next.js 16 application structured around the App Router. It integrates with Airtable (data), n8n (automation), and various AI providers (OpenRouter, ElevenLabs, D-ID).

```
.
├── apps/sophia-ai-factory/    # Main application root
│   ├── docs/                  # Project documentation
│   ├── openclaw/              # OpenClaw affiliate engine integration
│   ├── plans/                 # Development plans and reports
│   ├── public/                # Static assets
│   ├── scripts/               # Utility scripts (setup, verification)
│   ├── workflows/             # n8n workflow JSON exports
│   └── src/                   # Source code
│       ├── app/               # Next.js App Router pages
│       ├── config/            # Configuration and feature flags
│       ├── data/              # Static JSON data (affiliate programs)
│       ├── lib/               # Shared utilities (Airtable, API clients)
│       └── types/             # TypeScript definitions
```

## Key Directories & Files

### `/src/app` (Frontend Routes)
- **`/setup-wizard`**: The critical onboarding flow.
  - `page.tsx`: Main wizard logic.
  - `wizard-steps.tsx`: Component for individual steps.
  - `actions.ts`: Server actions for key verification and config generation.
- **`/dashboard`**: The main user interface.
  - `page.tsx`: Dashboard view.
- **`/api`**: Serverless API routes.
  - `/api/generate-script`: Triggers n8n script workflow.
  - `/api/render-video`: Triggers n8n video workflow.
  - `/api/setup`: Endpoint for wizard configuration validation.
  - `/api/heygen/*`: Direct proxy endpoints for HeyGen API.
- **`middleware.ts`**: Handles redirection logic.
  - Redirects unconfigured instances (missing `SETUP_COMPLETE` cookie/env) to `/setup-wizard`.
  - Protects `/admin` routes if configured.

### `/src/lib` (Core Logic)
- **`services/`**: Service Factory Architecture.
  - **`factory.ts`**: Central dependency injection container ensuring singleton instances.
  - **`types.ts`**: Core interfaces (`IVideoService`, `IVoiceService`, `IScriptService`) decoupling logic from implementation.
  - **`real/`**: Production implementations (HeyGen, ElevenLabs, OpenRouter).
  - **`mock/`**: Zero-cost, offline-capable mock implementations for development, testing, and CI/CD.
- **`heygen/`**: Legacy HeyGen client (deprecated in favor of services).
- **`airtable.ts`**: Typed client for Airtable operations.
- **`n8n.ts`**: Client for triggering n8n webhooks.

### `/scripts` (DevOps & Setup)
- **`infra-sync.sh`**: Master infrastructure synchronization script.
- **`smoke-test.ts`**: Production health verification script.
- **`setup.sh`**: Interactive shell script for verifying environment prerequisites.
- **`verify.sh`**: Comprehensive QA script (Lint, Type, Test, Audit).
- **`setup-vercel.sh`**: Automates Vercel project configuration and environment variable syncing.
- **`health-check.js`**: Standalone node script for checking API health.

### `/tests` (Testing)
- **`e2e/`**: Playwright end-to-end tests.
  - **`sanity.spec.ts`**: Core user flow verification in Mock Mode.
- **`mocks/`**: MSW handlers and test data.

### `/workflows` (Automation)
- Contains JSON exports of the n8n workflows required to run the "Brain" of the factory.
- **`script-generator.json`**: LLM pipeline for generating scripts from topics.
- **`video-generator.json`**: Orchestrates video creation (avatar + background).
- **`voice-generator.json`**: ElevenLabs TTS generation pipeline.
- **`publish-workflow.json`**: Final video publishing logic.

## Configuration Management
- **Environment Variables**:
  - Managed via `.env.local` (local) or Vercel Config (production).
  - Key variables: `OPENROUTER_API_KEY`, `ELEVENLABS_API_KEY`, `DID_API_KEY`, `AIRTABLE_API_KEY`, `AIRTABLE_BASE_ID`.
- **Feature Flags**:
  - Located in `src/config/flags.ts`.
  - `NEXT_PUBLIC_SETUP_WIZARD`: Controls wizard availability.
  - `NEXT_PUBLIC_FEATURE_AFFILIATE_ENGINE`: Toggles affiliate tools.

## Recent Major Changes
- **HeyGen Integration**: Added direct API integration for high-fidelity avatar video generation (`v1.5.0`).
- **Turnkey Setup Wizard**: Implemented a comprehensive 4-step wizard to eliminate manual `.env` editing for end-users.
- **Middleware Redirection**: Automatic routing to wizard for fresh installs.
- **Affiliate Engine**: Added `src/data/affiliate-programs.json` and discovery UI.
- **Testing Infrastructure**: Added Vitest configuration with unit and integration tests for core logic.

## Tech Stack Details
- **Framework**: Next.js 16.1.6
- **Language**: TypeScript 5
- **Styling**: Tailwind CSS 4
- **State Management**: React Server Actions + URL State
- **Database**: Airtable (via REST API)
- **AI Integration**: OpenRouter (LLM), ElevenLabs (TTS), D-ID / HeyGen (Video)
- **Testing**: Vitest, React Testing Library
