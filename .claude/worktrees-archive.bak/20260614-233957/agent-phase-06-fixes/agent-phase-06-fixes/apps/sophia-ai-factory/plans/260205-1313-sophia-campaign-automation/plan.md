# Campaign Automation Implementation Plan

## Overview
Implement an automated campaign orchestration system for Sophia AI Factory using Inngest (serverless queue) and Supabase. This system will handle long-running video generation tasks, manage campaign state, and provide real-time updates via Telegram and UI.

## Phases

- [x] **Phase 1: Setup Orchestration Infrastructure**
  - Install Inngest SDK
  - Configure Inngest with Next.js App Router
  - Set up Supabase-Inngest connection
  - Link: `./phase-01-setup-orchestration.md`

- [x] **Phase 2: Database Schema & Campaign Entities**
  - Create `campaigns` table with state machine status
  - Define Zod schemas for campaign data
  - Implement CampaignService for DB operations
  - Link: `./phase-02-campaign-schema.md`

- [x] **Phase 3: Automation Workflows (The Engine)**
  - Implement `generate-campaign` workflow
  - Create step functions: script gen -> voice gen -> video gen
  - Handle failures and retries
  - Link: `./phase-03-automation-workflows.md`

- [x] **Phase 4: Triggers & Notifications**
  - Connect Payment Webhook (Polar) to Campaign Trigger
  - Implement Telegram notifications for state changes
  - Set up Supabase Realtime for frontend updates
  - Link: `./phase-04-triggers-notifications.md`

- [x] **Phase 5: Frontend Integration**
  - Update Dashboard to display real-time status
  - Add "Create Campaign" UI connected to API
  - Link: `./phase-05-frontend-integration.md`

## Dependencies
- Inngest (via npx/managed)
- Supabase (Database + Realtime)
- Telegram Bot (Existing)
- Polar (Payments)
