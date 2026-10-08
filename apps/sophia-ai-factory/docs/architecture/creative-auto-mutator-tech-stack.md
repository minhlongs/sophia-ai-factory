# Architecture & Tech Stack: Creative Auto-Mutator

**Module:** Creative Auto-Mutator & Darwinian Evolution Engine
**Layers:** seed -> tree -> forest -> land | **Status:** SPECIFIED

---

## 1. Clean Architecture Stack Division

| Layer | Path | Responsibility | LOC Target |
|---|---|---|---|
| **seed** | `src/seed/types/creative-mutator-types.ts` | Mutation schemas, genetic operators, Zod validation | < 120 |
| **tree** | `src/tree/creative/mutation-engine.ts` | Pure Darwinian mutation generator (hook, visual, pacing) | < 150 |
| **tree** | `src/tree/creative/fitness-evaluator.ts` | Genetic fitness score & parent-child delta calculator | < 120 |
| **land** | `migrations/0454_creative_mutations.sql` | D1 schema for mutation tree & lineage | < 50 |
| **land** | `src/land/creative/mutation-store.ts` | D1 database queries for lineages, variants, rollups | < 180 |
| **land** | `src/land/creative/actions/mutation-actions.ts` | Authenticated Server Actions for UI cockpit | < 90 |
| **forest**| `src/forest/inngest/functions/creative-mutator-job.ts` | Inngest event worker (`creative.mutation.requested`) | < 150 |
| **UI** | `src/components/creative-mutator/*` | Obsidian Cyber-Glass Mutation Lineage & Dial controls | < 150 each |
| **Page**| `src/app/(app)/dashboard/creative-mutator/page.tsx` | Next.js 16 App Router dashboard route | < 80 |

---

## 2. Inngest Event Contracts

- **Trigger Event:** `creative.mutation.requested`
  ```typescript
  export type CreativeMutationRequestedEvent = {
    data: {
      userId: string;
      parentJobId: string;
      generation: number;
      mutationIntensity: 'CONSERVATIVE' | 'MODERATE' | 'RADICAL';
      triggerReason: 'HOOK_FATIGUE' | 'LOW_RETENTION' | 'WINNING_ARM_EXPLORE' | 'MANUAL';
      customOverrides?: {
        targetHookArchetype?: HookArchetype;
        targetVisualStyle?: string;
        pacingMultiplier?: number;
      };
    };
  };
  ```

- **Output Event:** `creative.mutation.spawned` / `video.requested`

---

## 3. Genetic Mutation Operators & Hyperparameters

1. **Mutation Intensity Matrix:**
   - **CONSERVATIVE:** Modifies pacing (1.05x) and text overlay; preserves core hook archetype and visual prompt.
   - **MODERATE:** Mutates hook angle to neighboring archetype; shifts camera motion and color grading.
   - **RADICAL:** Full hook archetype inversion (e.g. `AUTOMATION_PROOF` -> `POLARIZING_VERDICT`), visual style swap, and 1.12x pacing compression.

2. **Fitness Scoring Formula:**
   $$\text{Fitness} = 0.50 \times \text{HookScore} + 0.35 \times \text{RetentionScore} + 0.15 \times \min(100, \text{RoiPercent})$$

---

## 4. UI/UX Specifications
- **Theme:** Obsidian Cyber-Glass (dark background `#090d16`, amber primary token `#f59e0b`, indigo secondary token `#6366f1`).
- **Visuals:** Visual Lineage Tree (SVG connected nodes from $G_0$ to $G_n$), Real-Time Mutation Dials (Intensity, Exploration Temperature), Before/After Variant Diff viewer.
