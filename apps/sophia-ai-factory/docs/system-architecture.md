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
    end

    subgraph Data_Layer [Persistence]
        Airtable[Airtable Base]
        Env[Env Config (.env.local)]
    end

    subgraph Automation [n8n Workflows]
        GenScript[Generate Script Flow]
        GenVideo[Render Video Flow]
    end

    User --> Middleware
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
    Automation -- Update Status --> Airtable
```

## Core Components

### 1. The Frontend (Next.js 16)
- **Responsibility**: User Interface, Input Validation, Configuration Management.
- **Key Modules**:
  - `/setup-wizard`: A strictly guided flow to initialize the app.
  - `/dashboard`: Main operational view.
  - `/api/*`: Serverless functions acting as proxy to external services and n8n webhooks.

### 2. The Configuration Layer
- **Mechanism**: File-based `.env.local` generation.
- **Flow**:
  1. App starts without config.
  2. Middleware detects missing `SETUP_COMPLETE` flag.
  3. User is redirected to `/setup-wizard`.
  4. Wizard collects keys, validates them against real APIs.
  5. Wizard writes `.env.local` via `fs` (in dev) or instructions (in prod).

### 3. The Data Layer (Airtable)
- **Role**: Lightweight CMS and Database.
- **Why Airtable?**: Visual debugging for users, easy to edit data manually without admin UI.
- **Schema**:
  - `Scripts`: Stores generated text, status, and metadata.
  - `Videos`: Stores final video URLs and performance metrics.
  - `Affiliates`: Stores product research data.

### 4. The Automation Engine (n8n)
- **Role**: Heavy lifting and orchestration.
- **Why n8n?**: Visual workflow builder allows users to customize logic (e.g., change prompts) without coding.
- **Workflows**:
  - `Generate Script`: Webhook -> OpenRouter -> JSON Parse -> Airtable Update.
  - `Render Video`: Webhook -> ElevenLabs -> D-ID -> Airtable Update.

## Security Architecture

### API Key Management
- **Client-Side**: No sensitive keys are exposed to the browser.
- **Server-Side**: All API requests (validation, generation) are proxied through Next.js API Routes.
- **Storage**: Keys are stored in `.env.local` (local) or Vercel Environment Variables (production).

### Access Control
- **Turnkey Mode**: Single-user (Personal) deployment. No login required by default (assumes local/protected network or Vercel Basic Auth).
- **Admin Mode**: Optional Basic Auth middleware for public deployments.

## Data Flow: "New Project" Lifecycle

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

## Scalability Considerations
- **Frontend**: Stateless, deployable to Vercel Edge/Serverless.
- **Backend**: n8n can be self-hosted or cloud-hosted; scales independently.
- **Database**: Airtable has rate limits (5 requests/sec), suitable for SMB/Personal use. Future upgrade path: Supabase.
