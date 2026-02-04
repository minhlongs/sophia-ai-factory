# Project Overview & Product Development Requirements (PDR)

## Project Name
Sophia AI Video Factory

## Executive Summary
Sophia AI Video Factory is a turnkey, automated content generation platform designed to democratize AI video production. It enables users—regardless of technical skill—to discover high-performing affiliate products, generate engaging scripts using LLMs, create AI-narrated videos with avatars, and manage the publishing workflow.

The core differentiator is the **"Turnkey" experience**: a 4-step Setup Wizard that eliminates complex configuration, allowing users to go from "unboxing" to "first video" in minutes.

## Core Value Proposition
- **Zero-Code Setup**: Automated onboarding via the Setup Wizard.
- **End-to-End Automation**: From idea to video file without manual editing.
- **Affiliate Intelligence**: Built-in tools to find profitable niches.
- **Scalable Architecture**: Built on Next.js 16, utilizing edge-ready patterns.

## Product Requirements (PDR)

### 1. Functional Requirements

#### 1.1 Onboarding & Setup (The Wizard)
- **Goal**: Configure the application without touching code or `.env` files.
- **Features**:
  - **Step 1: Introduction**: clear value prop and checklist.
  - **Step 2: API Integration**: Interactive validation for OpenRouter, ElevenLabs, D-ID.
  - **Step 3: Database Connection**: One-click Airtable base duplication and connection (via PAT).
  - **Step 4: Completion**: Generation of local configuration and redirection to Dashboard.
- **Constraints**: Must handle validation errors gracefully and guide the user.

#### 1.2 Dashboard & Workspace
- **Goal**: Central command center for video operations.
- **Features**:
  - **Stats Overview**: View production metrics (scripts generated, videos published).
  - **Quick Actions**: Create new project, finding products.
  - **Recent Activity**: List of latest video projects.

#### 1.3 Affiliate Discovery Engine
- **Goal**: Identify content opportunities.
- **Features**:
  - Search/Filter affiliate programs (Amazon, ClickBank, etc.).
  - Analyze commission rates and "Gravity" (popularity).
  - "One-Click to Script": Convert a product listing into a video script draft.

#### 1.4 Content Generation Pipeline
- **Scripting**:
  - AI-powered script generation based on product URL or topic.
  - Support for multiple frameworks (AIDA, PAS, Storytelling).
- **Voiceover**:
  - ElevenLabs integration for high-quality TTS.
- **Video Rendering**:
  - D-ID or HeyGen integration for talking head avatars.
  - Background stock footage integration (Pexels/Pixabay).

### 2. Non-Functional Requirements

#### 2.1 Usability ("The Mom Test")
- The application must be usable by someone with zero coding knowledge.
- Error messages must be plain English, not stack traces.
- "Wizard" mode must activate automatically if configuration is missing.

#### 2.2 Performance
- **Core Web Vitals**: LCP < 2.5s on Dashboard.
- **Build Time**: < 1 minute on Vercel.
- **API Latency**: Real-time feedback during Wizard validation (< 2s).

#### 2.3 Security
- **API Key Storage**: Keys stored securely in environment variables (server-side only access where possible).
- **Access Control**: Basic Auth for Admin routes (optional but recommended).

## Tech Stack
- **Framework**: Next.js 16.1.6 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS 4
- **Database**: Airtable (User-friendly CMS)
- **Automation Backend**: n8n (Workflow orchestration)
- **AI Providers**: OpenRouter (LLM), ElevenLabs (Voice), D-ID (Avatar)

## Roadmap Status
- [x] **Phase 1: Foundation** - Next.js setup, UI components.
- [x] **Phase 2: Turnkey Wizard** - Interactive setup flow.
- [ ] **Phase 3: Core Pipeline** - Script-to-Video generation wiring.
- [ ] **Phase 4: Scaling** - Multi-user support and SaaS features.

## Success Metrics
- **Time-to-First-Video**: < 15 minutes (including setup).
- **Setup Success Rate**: > 90% of users complete the Wizard without errors.
- **User Retention**: > 40% of users generate 2+ videos in first week.
