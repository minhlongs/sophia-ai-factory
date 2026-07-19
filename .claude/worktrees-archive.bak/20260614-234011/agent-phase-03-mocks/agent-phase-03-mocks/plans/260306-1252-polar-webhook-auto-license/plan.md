---
title: Polar Webhook Auto-License Generation
description: Auto-generate RaaS license keys on subscription payment events via Polar webhooks
status: in-progress
priority: P1
effort: 8h
branch: main
tags: [polar, webhook, license, raas, subscription]
created: 2026-03-06
---

# Polar Webhook Auto-License Generation Plan

## Overview

Automatically generate and manage RaaS license keys when customers complete payment via Polar.sh. Links subscription lifecycle events to license creation, activation, and revocation.

## Problem Statement

**Current state:**
- Polar webhooks update user tier in `user_profiles` table
- License key generation is manual (admin-only via `/api/admin/licenses`)
- No automatic license provisioning on payment
- No automatic license revocation on cancellation

**Target state:**
- License auto-generated on `subscription.created` / `checkout.updated`
- License auto-deactivated on `subscription.cancelled`
- License reactivated on `subscription.active`
- Full audit trail of subscription → license linkage

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     Polar.sh Events                              │
└────────────────┬────────────────────────────────────────────────┘
                 │ webhook
                 ▼
┌─────────────────────────────────────────────────────────────────┐
│  /api/webhooks/polar (route.ts)                                 │
│  - Verify signature                                              │
│  - Idempotency check                                             │
└────────────────┬────────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────────┐
│  processWebhookEvent() (polar-webhook-handler.ts)               │
│  - switch(event.type)                                            │
│  - Call appropriate handler                                      │
└────────────────┬────────────────────────────────────────────────┘
                 │
    ┌────────────┼────────────┬────────────────┬──────────────┐
    │            │            │                │              │
    ▼            ▼            ▼                ▼              ▼
┌────────┐  ┌────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐
│checkout│  │sub     │  │sub       │  │sub       │  │order     │
│.updated│  │.created│  │.updated  │  │.cancelled│  │.created  │
└───┬────┘  └───┬────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘
    │          │            │              │             │
    │          │            │              │             │
    ▼          ▼            ▼              ▼             ▼
┌─────────────────────────────────────────────────────────────────┐
│                    raas-audit.ts                                 │
│  - createLicense()                                               │
│  - revokeLicense()                                               │
│  - deactivateLicense() / reactivateLicense()                     │
└────────────────┬────────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Supabase DB                                   │
│  - raas_licenses (subscription_id FK)                            │
│  - raas_audit_logs (webhook_event_id FK)                         │
│  - user_profiles (polar_subscription_id)                         │
└─────────────────────────────────────────────────────────────────┘
```

## Phases

| Phase | Title | Status |
|-------|-------|--------|
| [Phase 1: Auto-License Generation](./phase-01-auto-license-generation.md) | Generate license on payment success | **COMPLETE** |
| [Phase 2: Subscription Lifecycle](./phase-02-subscription-lifecycle.md) | Handle cancel, past_due, active events | pending |
| [Phase 3: Webhook Enhancements](./phase-03-webhook-enhancements.md) | Add new event types, idempotency, audit | pending |
| [Phase 4: Database Schema Updates](./phase-04-database-schema.md) | Add subscription_id FK, linkage | pending |
| [Phase 5: Testing & Security](./phase-05-testing-security.md) | Unit tests, integration tests, security | pending |

## Dependencies

- Supabase admin client (existing)
- Polar SDK (existing)
- RaaS audit service (existing - `raas-audit.ts`)
- Notification service (existing - Telegram)

## Unresolved Questions

1. Should license keys be emailed to customers or only shown in dashboard?
2. What is the grace period for `past_due` before deactivation?
3. Should trial subscriptions generate licenses?
