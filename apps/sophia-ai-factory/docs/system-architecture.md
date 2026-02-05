# System Architecture

## Overview
Sophia AI Video Factory utilizes a **Hybrid Architecture** combining a modern Next.js frontend with a low-code backend (n8n + Airtable) to deliver a powerful yet modifiable video production platform.

```mermaid
graph TD
    User[User Browser]

    subgraph Frontend [Next.js App Router]
        Wizard[Setup Wizard]
        Dash[Dashboard UI]
        API[Internal API Routes]
        Middleware[Middleware Logic]
    end

    subgraph External_Services [AI Services]
        OpenRouter[OpenRouter (LLM)]
        Eleven[ElevenLabs (Voice)]
        DID[D-ID (Avatar)]
        HeyGen[HeyGen (Premium Avatar)]
    end

    subgraph Data_Layer [Persistence]
        Airtable[Airtable Base]
        Env[Env Config (.env.local)]
    end

    subgraph Automation [n8n Workflows]
        GenScript[Generate Script Flow]
        GenVideo[Render Video Flow]
    end

    subgraph Mobile [Telegram]
        Bot[Telegram Bot]
    end

    User --> Middleware
    Mobile --> API
    Middleware -- Unconfigured --> Wizard
    Middleware -- Configured --> Dash

    Wizard --> API
    API --> Env
    API -- Validate --> External_Services
    API -- Validate --> Airtable

    Dash --> API
    API --> Airtable
    API -- Trigger --> Automation

    Automation --> OpenRouter
    Automation --> Eleven
    Automation --> DID
    API -- Direct --> HeyGen
    Automation -- Update Status --> Airtable
```

## Core Components

### 1. The Frontend (Next.js 16)
- **Responsibility**: User Interface, Input Validation, Configuration Management.
- **Key Modules**:
  - `/setup-wizard`: A strictly guided flow to initialize the app.
  - `/dashboard`: Main operational view.
  - `/api/*`: Serverless functions acting as proxy to external services.
- **Service Layer (New)**:
  - **Service Factory**: Centralized dependency injection pattern (`src/lib/services/factory.ts`).
  - **Abstraction**: Interfaces (`IVideoService`, `IVoiceService`, etc.) decouple logic from providers.
  - **Mock Mode**: Zero-cost development implementations (`src/lib/services/mock/`).

### 2. The Configuration Layer
- **Mechanism**: File-based `.env.local` generation.
- **Flow**:
  1. App starts without config.
  2. Middleware detects missing `SETUP_COMPLETE` flag.
  3. User is redirected to `/setup-wizard`.
  4. Wizard collects keys, validates them against real APIs.
  5. Wizard writes `.env.local` via `fs` (in dev) or instructions (in prod).

### 3. The Data Layer (Hybrid)
- **Primary DB (Supabase)**: User profiles, authentication, application settings, and encrypted API keys.
- **Content DB (Airtable)**: Lightweight CMS for Scripts, Videos, and Affiliate data.
- **Why Hybrid?**: Supabase handles secure user data and auth; Airtable remains for visual content management and n8n integration.
- **Schema**:
  - **Supabase**:
    - `user_profiles`: Stores `settings` (JSONB) and `api_keys` (Encrypted JSONB).
  - **Airtable**:
    - `Scripts`: Stores generated text, status, and metadata.
    - `Videos`: Stores final video URLs and performance metrics.
    - `Affiliates`: Stores product research data.

### 4. The Automation Engine (n8n)
- **Role**: Heavy lifting and orchestration.
- **Why n8n?**: Visual workflow builder allows users to customize logic (e.g., change prompts) without coding.
- **Workflows**:
  - `script-generator.json`: Webhook -> OpenRouter -> JSON Parse -> Airtable Update.
  - `video-generator.json`: Webhook -> ElevenLabs -> D-ID -> Airtable Update.
  - `voice-generator.json`: Text-to-Speech generation.
  - `publish-workflow.json`: Final publishing steps.

### 5. Payment Infrastructure (Polar)
- **Role**: Payment processing for one-time product purchases (Starter, Growth, Premium).
- **Flow**:
  1. **Checkout**: User clicks "Buy Now" -> `/api/checkout` -> Redirects to Polar Checkout.
  2. **Processing**: Polar handles card processing and fraud detection.
  3. **Fulfillment**: Polar sends webhook -> `/api/webhooks/polar` -> App updates User Profile (sets `subscription_tier`).
- **Security**:
  - Webhook signatures verified using `standard-webhooks`.
  - No payment data stored in application database.
  - Product IDs and Secrets managed via environment variables.

### 6. Mobile Command Center (Telegram)
- **Role**: Remote interface for campaign management.
- **Components**:
  - **Bot**: Registers webhooks with Telegram API.
  - **Webhook Handler**: Validates secrets and routes commands (`/campaign`, `/status`).
  - **User Mapping**: Links `chat_id` to Supabase `user_id` via `/email` verification.
- **Flow**:
  1. **Command**: User sends `/campaign New Topic`.
  2. **Validation**: Bot checks if `chat_id` exists in `user_profiles`.
  3. **Trigger**: Bot inserts record into `campaigns` and sends `campaign.created` event to Inngest.
  4. **Feedback**: Bot replies with "Campaign Started".
  5. **Notification**: (Future) System sends push notification back to Telegram on completion.

## Security Architecture

### API Key Management
- **Client-Side**: No sensitive keys are exposed to the browser. Keys are masked (e.g., `sk-****`).
- **Server-Side**: All API requests are proxied through Next.js API Routes / Server Actions.
- **Storage**:
  - **System Keys**: stored in `.env.local` (local) or Vercel Environment Variables.
  - **User Keys**: stored in Supabase `user_profiles` table, encrypted at rest using AES-256-GCM.

### Access Control
- **Turnkey Mode**: Single-user (Personal) deployment. No login required by default (assumes local/protected network or Vercel Basic Auth).
- **Admin Mode**: Optional Basic Auth middleware for public deployments.

### 7. Feature Gating & Tier Enforcement
- **Philosophy**: "Secure by Design" - Enforcement happens at the API level, UI is just a reflection.
- **Tiers**:
  - **BASIC (Starter)**: Entry level, 1 channel, manual workflow.
  - **PREMIUM (Growth)**: Automation enabled, 3 channels, affiliate engine.
  - **ENTERPRISE (Premium)**: Unlimited scale, API access, white-glove features.
- **Enforcement Layers**:
  1.  **Middleware / API Routes**: `TierGuard` function checks `user_profiles.subscription_tier` before processing requests.
      - *Example*: POST `/api/campaigns` checks if `campaign_count < tier_limit`.
  2.  **UI Layer**: Components check `useTier()` hook to show/hide features or display "Upgrade" banners.
  3.  **Database**: Row Level Security (RLS) can be used for hard limits (future optimization).
- **Limits Config**: Defined in `src/config/tiers.ts` as the single source of truth.

### 8. CI/CD & Automation (Binh Pháp Strategy)
- **Pipeline**: GitHub Actions (`.github/workflows/ci-cd.yml`).
  - **Lint & Type Check**: Static analysis.
  - **Unit Tests**: Vitest for logic verification.
  - **E2E Tests**: Playwright running against **Mock Mode** for deterministic UI testing.
- **Deployment**:
  - **Vercel**: Automated preview deployments for PRs.
  - **Infrastructure**: Idempotent scripts (`scripts/infra-sync.sh`) for setup.
  - **Verification**: Post-deploy smoke tests (`scripts/smoke-test.ts`) using deep health checks.

## Data Flow: "New Project" Lifecycle

### Standard Flow (n8n Orchestration)
1. **Initiation**: User clicks "New Project" in Dashboard.
2. **Input**: User provides Topic or Product URL.
3. **Storage**: App creates a "Draft" record in Airtable `Scripts` table.
4. **Trigger**: App calls n8n `generate-script` webhook with Record ID.
5. **Processing (Async)**:
   - n8n fetches record.
   - n8n calls LLM to generate script.
   - n8n updates Airtable record with content and changes status to `generated`.
6. **Review**: User sees updated script in Dashboard (via SWR/Polling).
7. **Approval**: User clicks "Generate Video".
8. **Rendering (Async)**:
   - App calls n8n `render-video` webhook.
   - Audio generated, then Video.
   - Final URL updated in Airtable.

### Enterprise Flow (Direct HeyGen Integration)
1. **Initiation**: User selects "Premium Avatar" in Campaign Wizard.
2. **Input**: Script Text, Avatar ID, Voice ID.
3. **Submission**: App calls `POST /api/heygen/create-video` directly.
4. **Processing (Async)**:
   - HeyGen API accepts job, returns `video_id`.
   - App stores `video_id` in Supabase/Airtable.
5. **Polling**:
   - Client polls `GET /api/heygen/status/[id]`.
   - UI shows real-time progress bar (Queued -> Processing -> Completed).
6. **Completion**:
   - Status becomes `completed`.
   - Video URL is displayed for playback/download.

## Scalability Considerations
- **Frontend**: Stateless, deployable to Vercel Edge/Serverless.
- **Backend**: n8n can be self-hosted or cloud-hosted; scales independently.
- **Database**: Airtable has rate limits (5 requests/sec), suitable for SMB/Personal use. Future upgrade path: Supabase.
