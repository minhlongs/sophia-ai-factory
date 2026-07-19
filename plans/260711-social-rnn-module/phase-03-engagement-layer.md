---
phase: 3
title: "Engagement Layer"
status: pending
priority: P2
dependencies: [2]
effort: "5h"
---

# Phase 3: Engagement Layer

## Overview

Hourly Inngest cron sweeps published posts, fetches engagement metrics, stores in D1. Monitoring only — no auto-reply.

## TDD Workflow

**RED**: Mock metric fetcher tests
**GREEN**: Implement collector + storage
**REFACTOR**: Normalize per-channel metrics

## Test-First Checklist

**Metrics Fetcher**
- [ ] Test: Telegram → normalize views/likes/shares/comments
- [ ] Test: Facebook Graph API → extract reactions + shares
- [ ] Test: TikTok → extract views + likes + comments
- [ ] Test: YouTube → extract views + likes + comments
- [ ] Test: API error → return nulls, don't crash collector

**Engagement Collector**
- [ ] Test: Sweeps recent delivery_receipts (not yet fetched)
- [ ] Test: Rate limit respected (token bucket per channel)
- [ ] Test: Stored in engagement_metrics table
- [ ] Test: Failed fetch → retry next cycle (not blocked)

**Rate Limiter**
- [ ] Test: Telegram 1 req/sec enforced
- [ ] Test: Facebook 200 calls/hr enforced
- [ ] Test: YouTube 10k units/day enforced

## Implementation Steps

1. Migration 0223: engagement_metrics table
2. metrics-fetcher.ts: per-channel metric extraction + normalization
3. engagement-collector.ts: Inngest cron job
4. Rate limiter: per-channel token bucket
5. engagement-dashboard-action: Server Action
6. Dead-letter posts retry next cycle

## Success Criteria

- [ ] Metrics appear within 1 hour of publish
- [ ] Views/likes/comments/shares tracked across all channels
- [ ] No rate limit violations
- [ ] Dashboard action returns aggregated metrics

## Risk Assessment

- Facebook needs App Review for full engagement API. Dev mode supported.
