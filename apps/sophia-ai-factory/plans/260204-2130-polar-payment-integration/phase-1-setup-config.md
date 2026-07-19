# Phase 1: Setup & Configuration

## Context
Initial setup of the Polar SDK environment within the Next.js application.

## Overview
Install necessary dependencies and configure the base client for communicating with the Polar API.

## Requirements
- Install `@polar-sh/sdk`
- Install `standard-webhooks` (required for signature verification)
- Configure `POLAR_ACCESS_TOKEN`, `POLAR_ORGANIZATION_ID`, `POLAR_WEBHOOK_SECRET`
- Create typed Polar client instance

## Implementation Steps
1.  **Install Packages**
    - Run `npm install @polar-sh/sdk standard-webhooks`

2.  **Environment Configuration**
    - Add variables to `.env.local`
    - Update `src/types/env.d.ts` (if exists) or create valid type definitions for process.env

3.  **Client Initialization**
    - Create `src/lib/polar.ts`
    - Export configured Polar instance
    - Export helper for webhook verification

## Todo
- [ ] Install dependencies
- [ ] Configure environment variables
- [ ] Create `src/lib/polar.ts`

## Success Criteria
- `npm install` completes without errors
- `Polar` client can be imported from `@/lib/polar`
- Environment variables are accessible
