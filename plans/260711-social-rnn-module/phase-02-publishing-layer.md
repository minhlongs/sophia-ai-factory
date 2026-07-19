---
phase: 2
title: "Publishing Layer"
status: pending
priority: P2
dependencies: [1]
effort: "6h"
---

# Phase 2: Publishing Layer

## Overview

Build D1-backed publish job queue. After video generation completes, publish_jobs are enqueued. RNN scheduler picks optimal time per channel. Idempotent delivery.

## TDD Workflow

**RED**: Queue + retry tests
**GREEN**: Implement scheduler + job queue
**REFACTOR**: Extract scheduling logic

## Test-First Checklist

**RNN Scheduler**
- [ ] Test: Returns optimal publish time (engagement-based logic)
- [ ] Test: Handles timezone per user/channel
- [ ] Test: Respects max posts per day limit

**Publishing Queue**
- [ ] Test: Enqueue job after video generation
- [ ] Test: Job status transitions: pending → sent → failed → retry
- [ ] Test: Retry with exponential backoff (max 3 attempts)
- [ ] Test: Dead-letter after 3 failures
- [ ] Test: Idempotent: re-publish same video_id + channel → no duplicate

**Database Layer**
- [ ] Test: publish_jobs table CRUD
- [ ] Test: delivery_receipts records success URL
- [ ] Test: Foreign key integrity (video_job_id → videos)

## Implementation Steps

1. Migration 0222: publish_jobs + delivery_receipts tables
2. rnn-scheduler.ts: optimal time calculation per channel
3. publishing-queue.ts: DB-backed queue with status + retry
4. publish-video-action: Server Action linking video → publish jobs
5. Wire into Inngest: after video generation, enqueue publish jobs
6. Write tests (mock channel adapters)
7. Retry + dead-letter logic

## Success Criteria

- [ ] publish_jobs populated after video generation
- [ ] Content publishes to Telegram on schedule
- [ ] Receipt stored with platform URL
- [ ] Failed jobs retry 3 times, then dead-letter
- [ ] All tests pass

## Risk Assessment

- Inngest step ordering: must run publish AFTER video generation. Verify with integration test.
