# Phase 05: Setup Wizard Integration

## Context Links
- **Project**: /Users/macbook/sophia-ai-factory/apps/sophia-ai-factory
- **Plan**: /Users/macbook/sophia-ai-factory/apps/sophia-ai-factory/plans/260810-1530-omniroute-router-strategy/plan.md
- **Phase 04**: /Users/macbook/sophia-ai-factory/apps/sophia-ai-factory/plans/260810-1530-omniroute-router-strategy/phase-04-inngest-integration.md
- **Setup Wizard**: /Users/macbook/sophia-ai-factory/apps/sophia-ai-factory/src/tree/components/setup-wizard/

## Overview
Add a new step to the Setup Wizard for customers to select their preferred routing strategy. This is a customer-facing feature (non-technical CEOs), so the UI must be bilingual (Vietnamese + English) with clear explanations and no developer jargon.

**Priority**: MEDIUM — User-facing configuration
**Status**: Pending
**Estimated Effort**: 3-4 hours

## Key Insights
1. **Setup Wizard Flow** (from api-keys-step.tsx, provider-credentials-step.tsx):
   - Step 1: Welcome
   - Step 2: API Keys (OpenRouter, ElevenLabs, D-ID, etc.)
   - Step 3: Provider Credentials (HeyGen, Resend, NOWPayments)
   - Step 4: Review
   - Step 5: Finish

2. **New Step Position**: After API Keys step (Step 2), before Provider Credentials (Step 3) — logical flow: keys first, then strategy preference

3. **Strategy Options for Non-Technical Users**:
   - **Priority** (Default): "Use recommended providers first" / "Ưu tiên nhà cung cấp khuyến nghị"
   - **Cost Optimized**: "Choose cheapest option" / "Chọn tùy chọn tiết kiệm chi phí nhất"
   - **Least Used**: "Balance load across providers" / "Cân bằng tải giữa các nhà cung cấp"

4. **Storage**: User preference saved to `user_profiles.profile_json.routing_strategy` (from Phase 04)

4. **Bilingual Messages**: Need translations in `messages/vi.json` and `messages/en.json` under `setupWizard.strategySelection`

## Requirements
- New step component: `strategy-selection-step.tsx`
- Bilingual labels, descriptions, help text
- Zod validation on strategy selection
- Server Action to save preference (not API route)
- Integration with existing wizard stepper
- No breaking changes to existing steps

## Architecture
```
src/tree/components/setup-wizard/steps/strategy-selection-step.tsx (NEW)
src/tree/components/setup-wizard/steps/index.ts (export)
src/app/(dashboard)/setup-wizard/actions.ts (Server Action - NEW or modify)
messages/vi.json (translations)
messages/en.json (translations)
```

**Layer**: tree/components (UI), land/billing/actions (Server Action - if new)
**Imports**: `@/seed/config/routing-strategies` (for strategy list), `@/seed/auth/better-auth-session` (for user)

## Related Code Files

### Files to Create
1. `/src/tree/components/setup-wizard/steps/strategy-selection-step.tsx` — New step component
2. `/src/app/(dashboard)/setup-wizard/actions.ts` — Server Action for saving strategy preference

### Files to Modify
1. `/src/tree/components/setup-wizard/steps/index.ts` — Export new step
2. `/src/tree/components/setup-wizard/wizard-stepper.tsx` — Add step to flow
3. `/src/app/(dashboard)/setup-wizard/page.tsx` — Include new step
4. `/messages/vi.json` — Vietnamese translations
5. `/messages/en.json` — English translations

### Files to Read
1. `/src/tree/components/setup-wizard/steps/api-keys-step.tsx` — Pattern for step structure
2. `/src/tree/components/setup-wizard/wizard-stepper.tsx` — Step ordering
3. `/src/app/(dashboard)/setup-wizard/page.tsx` — Wizard page composition

## Implementation Steps

### Step 1: Add Translations
In `messages/vi.json` and `messages/en.json`:
```json
{
  "setupWizard": {
    "strategySelection": {
      "title": "Chiến lược định tuyến / Routing Strategy",
      "description": "Chọn cách hệ thống chọn nhà cung cấp AI cho video của bạn / Choose how the system selects AI providers for your videos",
      "helpText": "Điều này ảnh hưởng đến chi phí, tốc độ và độ tin cậy / This affects cost, speed, and reliability",
      "options": {
        "priority": {
          "label": "Ưu tiên khuyến nghị / Recommended Priority",
          "description": "Sử dụng nhà cung cấp tốt nhất theo thứ tự ưu tiên / Use best providers in priority order"
        },
        "cost-optimized": {
          "label": "Tiết kiệm chi phí / Cost Optimized",
          "description": "Luôn chọn tùy chọn rẻ nhất có sẵn / Always choose cheapest available option"
        },
        "least-used": {
          "label": "Cân bằng tải / Load Balanced",
          "description": "Phân phối đều qua các nhà cung cấp / Distribute evenly across providers"
        }
      }
    }
  }
}
```

### Step 2: Create Strategy Selection Step Component
```typescript
// strategy-selection-step.tsx
"use client";
import React from 'react';
import { useTranslations } from 'next-intl';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { STRATEGY_NAMES, type StrategyName } from '@/seed/config/routing-strategies';

interface StrategySelectionStepProps {
  selectedStrategy: StrategyName;
  onChange: (strategy: StrategyName) => void;
}
```

### Step 3: Create Server Action for Saving Preference
```typescript
// app/(dashboard)/setup-wizard/actions.ts
'use server';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { createServerClient } from '@/seed/db/client';
import { z } from 'zod';

const StrategySchema = z.enum(['priority', 'cost-optimized', 'least-used']);

export async function saveRoutingStrategy(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) throw new Error('Unauthorized');
  
  const strategy = StrategySchema.parse(formData.get('routing_strategy'));
  
  const db = createServerClient();
  const profile = await db.prepare('SELECT profile_json FROM user_profiles WHERE user_id = ?1')
    .bind(user.id).first<{ profile_json: string }>();
  
  const profileJson = profile?.profile_json ? JSON.parse(profile.profile_json) : {};
  profileJson.routing_strategy = strategy;
  
  await db.prepare(
    'INSERT INTO user_profiles (user_id, profile_json, updated_at) VALUES (?1, ?2, ?3) ' +
    'ON CONFLICT(user_id) DO UPDATE SET profile_json = ?2, updated_at = ?3'
  ).bind(user.id, JSON.stringify(profileJson), new Date().toISOString()).run();
  
  return { success: true };
}
```

### Step 4: Integrate into Wizard Stepper
Modify `wizard-stepper.tsx` to include new step between API Keys and Provider Credentials.

### Step 5: Update Wizard Page
Add strategy selection step to the wizard flow in `page.tsx`.

### Step 6: Run Tests
```bash
npm test -- --filter=strategy-selection-step
npm test -- --filter=setup-wizard
npm run type-check
npm run lint
```

## Todo List
- [ ] Add translations to vi.json and en.json
- [ ] Create strategy-selection-step.tsx component
- [ ] Export step from steps/index.ts
- [ ] Create saveRoutingStrategy Server Action
- [ ] Update wizard-stepper.tsx step order
- [ ] Update setup-wizard page.tsx
- [ ] Run component tests
- [ ] Run full test suite
- [ ] Run type-check and lint

## Success Criteria
- [ ] New step appears in Setup Wizard after API Keys step
- [ ] Bilingual labels display correctly (VI/EN)
- [ ] User can select one of three strategies
- [ ] Selection saved to user_profiles via Server Action
- [ ] Preference used by Inngest workflows (Phase 04)
- [ ] All existing wizard tests pass
- [ ] Type-check passes with 0 errors
- [ ] No `:any` types

## Risk Assessment
| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Breaking existing wizard flow | Medium | High | Add step without modifying existing step logic; test full flow |
| Translation missing | Low | Medium | Copy pattern from existing steps; verify both locales |
| Server Action not called | Medium | Medium | Follow existing wizard action patterns; test save |
| User confusion on strategy choice | Medium | Low | Clear descriptions, help tooltips, default highlighted |

## Security Considerations
- Server Action validates user session (getCurrentUser)
- Zod validation on strategy enum
- No API keys exposed in UI
- Preference stored in user profile (user-owned data)

## Next Steps
Phase 06: Tests — Comprehensive test coverage for all new components