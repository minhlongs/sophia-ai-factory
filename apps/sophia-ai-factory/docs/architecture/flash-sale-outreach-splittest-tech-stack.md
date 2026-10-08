# Tech Stack: Real-Time Flash-Sale Sync, Autonomous Competitor Outreach & Split-Test Attribution

> Strategic Expansion Architecture for Sophia AI Factory Live & Growth Suite
> Date: 2026-10-08 | Doctrine: Clean 4-Layer Architecture (seed -> tree -> forest -> land)

---

## 1. Pillars & Capabilities

### Pillar 1: Real-Time Live Flash-Sale & Cart Inventory Synchronizer
- **Goal**: Synchronize live shopping cart stock & dynamically inject surge discount vouchers during viewership spikes.
- **Components**:
  - `seed`: Types & Zod schemas for Flash Deals, Stock Status, and Surge Triggers.
  - `tree`: `live-stock-synchronizer.ts` (computes FOMO surge vouchers based on viewer surge percentage and stock thresholds).
  - `forest`: Inngest event `live.stream.stock.surge.detected`.
  - `land`: Server action `triggerSurgeVoucherAction` & UI live banner trigger.

### Pillar 2: Autonomous Competitor Video Comment Outreach & Prospecting Engine
- **Goal**: Prospect high-intent buyer comments on competitor videos with strict anti-spam limits.
- **Components**:
  - `seed`: Types & Zod schemas for Competitor Videos, Comment Leads, and Outreach Messages.
  - `tree`: `competitor-outreach-engine.ts` (evaluates purchase intent & generates tailored DM response adhering to rate limits).
  - `forest`: Inngest event `competitor.lead.discovered`.
  - `land`: Server action `dispatchOutreachAction`.

### Pillar 3: Split-Test Hook Attribution & Auto-Loss Cut Optimization Engine
- **Goal**: Route traffic between video variants (Hook A vs Hook B) and automatically pause losing variants based on net conversion ROI.
- **Components**:
  - `seed`: Types & schemas for Split Test Experiments, Variant Splits, and Net ROI Thresholds.
  - `tree`: `split-test-attribution-engine.ts` (computes Wilson score confidence interval, ROI, and auto-pause decision).
  - `forest`: Inngest event `video.splittest.evaluation.requested`.
  - `land`: Server action `evaluateSplitTestAction`.

---

## 2. Layer Constraints & Code Invariants
- **File size**: Strictly <= 200 LOC per file.
- **Clean Architecture**: `seed` -> `tree` -> `forest` -> `land`. Zero backwards imports.
- **Type Safety**: Zero `:any` types. Strict Zod schemas.
- **Reliability**: No mock data; 100% real deterministic pure logic with full Vitest test coverage.
