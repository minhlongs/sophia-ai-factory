/**
 * Database type definitions — DEPRECATED
 *
 * This file is maintained for backward compatibility only.
 * New code should import from '@/seed/types/<domain>' directly.
 *
 * Migration: All types have been moved to seed/types/ submodules:
 * - user.ts     → User profile, session, telegram mapping types
 * - affiliate.ts → Affiliate offers, integrations, metrics
 * - video.ts     → Campaigns, usage events, quota tracking
 * - billing.ts   → Billing events, dunning, overage, quota limits
 * - raas.ts      → RaaS licenses, API keys, audit logs
 * - infra.ts     → Rate limiting, usage summaries
 * - database.ts  → Database interface
 * - json.ts      → Json type alias
 *
 * @deprecated Use '@/seed/types/video', '@/seed/types/affiliate', etc.
 * @module seed/types (barrel re-export)
 */

export * from '@/seed/types';
