/**
 * Server Actions for Partner Invitation & Onboarding Flow - Root Facade.
 *
 * Implements secure transactional invitation creation, CSRF checking,
 * rate limiting, 256-bit crypto token generation, Cloudflare D1 persistence,
 * canonical IoC bilingual email dispatch, and atomic OCC redemption.
 *
 * Layer: forest (Server Actions / Orchestrators)
 * Dependencies: @/seed/*, @/tree/*
 *
 * @module forest/actions/affiliate-actions
 */

'use server';

export * from './affiliate';
