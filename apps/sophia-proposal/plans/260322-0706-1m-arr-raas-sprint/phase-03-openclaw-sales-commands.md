---
phase: 3
title: "OpenClaw Sales Commands"
priority: P1
status: pending
effort: 5h
---

# Phase 3 — OpenClaw Sales Commands

## Context Links
- [OpenClaw Engine](../../lib/openclaw/engine.ts)
- [Command Router](../../lib/raas/command-router.ts)
- [Command Helpers](../../lib/raas/command-helpers.ts)
- [MCU Pricing](../../lib/billing/mcu-pricing.ts)

## Overview

Add 5 new sales commands to OpenClaw: `sales:proposal-deck`, `sales:roi-calculator`, `sales:competitor-analysis`, `sales:pricing-optimizer`, `sales:battlecard` (already exists — enhance with AI).

## Key Insights

- `sales:battlecard` exists in `command-helpers.ts` (line 255-294) — uses static template, no AI
- Command pattern: add to `STEP_NAMES` in engine.ts + add case in `command-router.ts` + implement in helpers
- Each command follows PEV: Plan steps → Execute → Verify result
- MCU cost per sales command: ~10-25 MCU (similar to proposal:create)
- Commands should use Anthropic Claude for AI generation (existing pattern in proposal engine)

## Requirements

### Functional

| Command | Input Params | Output | MCU |
|---------|-------------|--------|-----|
| `sales:battlecard` | `competitor`, `product` | Enhanced AI battlecard | 15 |
| `sales:proposal-deck` | `client_name`, `product`, `deal_size`, `industry` | Slide deck JSON | 20 |
| `sales:roi-calculator` | `client_name`, `current_costs`, `team_size` | ROI analysis | 15 |
| `sales:competitor-analysis` | `competitors[]`, `market` | Multi-competitor matrix | 25 |
| `sales:pricing-optimizer` | `target_market`, `current_pricing`, `competitor_pricing` | Pricing recommendations | 20 |

### Non-functional
- Each command < 30s execution
- AI-generated content, not static templates
- Error handling: missing params return clear error messages

## Architecture

```
POST /api/v1/missions { command: "sales:proposal-deck", params: {...} }
  → PEV Engine → buildPlan() → 3 steps
  → executeCommand() → command-router → sales-command-handlers.ts
  → Anthropic Claude generates content
  → Verify result.success && result.data
  → Webhook notification
```

## Related Code Files

### Files to modify
- `lib/openclaw/engine.ts` — add 4 new entries to `STEP_NAMES`
- `lib/raas/command-router.ts` — add 4 new cases to switch
- `lib/raas/command-helpers.ts` — enhance `runSalesBattlecard` with AI
- `lib/billing/mcu-pricing.ts` — add MCU costs for new commands
- `types/raas.ts` — add new command literals to `MissionCommand` type

### Files to create
- `lib/raas/sales-command-handlers.ts` — 4 new command implementations (keep command-helpers.ts under 200 lines)

## Implementation Steps

1. Add command type literals to `types/raas.ts` MissionCommand union
2. Add `STEP_NAMES` entries in `lib/openclaw/engine.ts`:
   - `sales:proposal-deck`: ['Analyze client profile', 'Generate deck slides', 'Save proposal deck']
   - `sales:roi-calculator`: ['Gather cost data', 'Calculate ROI projections', 'Format report']
   - `sales:competitor-analysis`: ['Research competitors', 'Build comparison matrix', 'Generate insights']
   - `sales:pricing-optimizer`: ['Analyze market data', 'Model pricing scenarios', 'Generate recommendations']
3. Create `lib/raas/sales-command-handlers.ts`:
   - `runSalesProposalDeck(mission)` — uses Anthropic to generate slide structure
   - `runSalesRoiCalculator(mission)` — calculates ROI with AI narrative
   - `runSalesCompetitorAnalysis(mission)` — multi-competitor comparison
   - `runSalesPricingOptimizer(mission)` — pricing model analysis
4. Update `lib/raas/command-router.ts` — import and route new commands
5. Enhance `runSalesBattlecard` — integrate Anthropic for AI content (not static)
6. Add MCU costs to billing pricing config
7. Write tests for each command

## Todo List

- [ ] Update `types/raas.ts` with new command types
- [ ] Add STEP_NAMES to engine.ts
- [ ] Create `sales-command-handlers.ts` with 4 implementations
- [ ] Update command-router.ts switch cases
- [ ] Enhance sales:battlecard with AI
- [ ] Add MCU pricing for new commands
- [ ] Write unit tests (5 commands x 2 tests each = 10 new tests)
- [ ] Run full test suite

## Success Criteria

- All 5 sales commands execute via PEV engine
- Each returns `{ success: true, data: {...} }`
- MCU deducted correctly per command
- 10+ new tests pass
- Total test count 193+

## Risk Assessment

- **Anthropic API rate limits** — use existing client with retry
- **Command helpers file too large** — already planned split to `sales-command-handlers.ts`
- **AI content quality** — verify output structure, not content quality

## Security Considerations

- Sanitize all user params (competitor names, client names) before passing to LLM
- No PII stored in mission results beyond what user provided
