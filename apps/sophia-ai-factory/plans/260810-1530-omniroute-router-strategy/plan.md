# OmniRoute RouterStrategy Implementation Plan

## Overview
Implement the OmniRoute RouterStrategy pattern for multi-provider video generation routing in Sophia AI Factory. This enables intelligent provider selection (OpenRouter, ElevenLabs, D-ID, HeyGen) based on cost, latency, priority, and availability.

## Timeline
- **Target**: 2-3 days for full implementation
- **Baseline**: 6,570 tests passing, build green, deploy SHA db7be93f

## Phases
1. **Phase 01**: Interface & Constants (`src/forest/quota/routing-strategy.ts`, `src/seed/config/routing-strategies.ts`)
2. **Phase 02**: Strategy Implementations (PriorityStrategy, CostOptimizedStrategy, LeastUsedStrategy)
3. **Phase 03**: BYOK Integration (provider abstraction, key resolution)
4. **Phase 04**: Inngest Integration (video-generate.ts, video-tts.ts, video-visual.ts)
5. **Phase 05**: Setup Wizard Integration (strategy selection UI)
6. **Phase 06**: Tests (unit + integration)

## Key Integration Points
- **seed**: `routing-strategies.ts` (constants, types, registry)
- **forest/quota**: `routing-strategy.ts` (interface, implementations, registry)
- **tree/byok**: provider key resolution
- **forest/inngest/functions**: video-generate, video-tts, video-visual
- **tree/components/setup-wizard**: strategy selection step

## Architecture Compliance
- seed → importable by all
- tree → imports seed only
- forest → imports seed, tree (+ may CALL land)
- land → imports seed, tree, forest

## Protected Flows (MUST NOT BREAK)
1. Setup Wizard — BYOK onboarding
2. Telegram Bot — @Sophia_Bbot commands
3. Payment Flow — NOWPayments IPN → tier activation