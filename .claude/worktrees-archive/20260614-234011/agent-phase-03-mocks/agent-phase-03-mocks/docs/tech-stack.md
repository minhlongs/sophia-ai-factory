# Tech Stack Specification — Sophia AI Factory

This document details the approved technology stack for the Sophia AI Factory SaaS platform.

## Core Framework
* **Next.js 16:** App Router architecture.
* **React 19:** Utilizing Server Actions for state mutations and React Server Components (RSC) for data rendering.
* **TypeScript:** Enforced strict mode, zero-tolerance for `:any` types.

## Database & Caching
* **Cloudflare D1:** Distributed SQLite database serving as the primary persistent layer.
* **Supabase:** Used for Postgres OAuth callbacks and admin invites.
* **Upstash Redis:** Used for transient state caching.

## Authentication & Authorization
* **Better Auth v1.6.2:** D1 Kysely adapter for email/password, magic links, and multi-tenant organization boundaries.

## Payments & Revenue
* **NOWPayments:** USDT crypto subscriptions (BASIC, PREMIUM, ENTERPRISE, MASTER).
* **PayOS:** Vietnam domestic payment gateway backup.
* **Self-hosted / BYOK:** Customers bring their own API keys (HeyGen, ElevenLabs, OpenRouter).

## Styling & Layout
* **Tailwind CSS 4:** CSS variables-first design system with custom interactive animations.

## Deployment & Hosting
* **Cloudflare Workers:** Direct deployment via Wrangler CLI (`npm run deploy:full`).
