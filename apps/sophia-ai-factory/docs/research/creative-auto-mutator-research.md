# Research: Creative Auto-Mutator & Darwinian Video Evolution Engine

**Project:** Sophia AI Factory | **Layer:** Architecture & Domain Logic | **Status:** APPROVED

---

## 1. Problem Statement & Motivation
In autonomous short-form video generation (YouTube Shorts, TikTok, Instagram Reels), creative fatigue is rapid (typically 3–7 days). 
When a hook angle saturates or an initial arm performs poorly (Hook Score < 65, 3s view rate < 50%), creating manual variants costs time. 
The **Creative Auto-Mutator** applies genetic evolution algorithms to automatically breed high-performing video variations from existing scripts and video blueprints.

---

## 2. Darwinian Mutation Operators
1. **Hook Archetype Mutation:**
   - Shifts the first 3 seconds through distinct emotional triggers:
     - `STATISTIC_PAIN` -> "83% of devs lose 4 hours daily to..."
     - `POLARIZING_VERDICT` -> "Stop using manual video editing in 2026."
     - `FINANCIAL_LOSS_WARNING` -> "You are leaking $1,400/month by ignoring this."
     - `AUTOMATION_PROOF` -> "Watch this AI build a full campaign in 14 seconds."
   - Retains the core value proposition while mutating the cognitive hook.

2. **Visual B-Roll & Dynamic Camera Mutation:**
   - Swaps visual generation prompts:
     - Style variations: `cyberpunk_neon`, `cinematic_documentary`, `minimalist_clay`, `photorealistic_macro`.
     - Motion vectors: `rapid_push_in`, `whip_pan`, `glitch_cut`, `slow_dolly_zoom`.

3. **Audio Pacing & Tempo Compression:**
   - Dynamically compresses TTS voiceover duration by 1.05x–1.15x for high-energy platforms (TikTok).
   - Swaps soundtrack mood between `high_energy`, `suspense_drop`, and `lo_fi_urgency`.

4. **CTA & Thumbnail Overlay Mutation:**
   - Rotates curiosity gap text, discount percentage badges, and urgency tags.

---

## 3. Genetic Lineage & Multi-Armed Bandit Integration
- **Lineage Representation:**
  - Parent Video ID ($G_0$) -> Child Variant IDs ($G_1, G_2$).
  - Every child carries a `MutationDelta` payload recording:
    `{ hookAngle: string, visualStyle: string, tempoMultiplier: number, parentId: string }`
- **Thompson Sampling Feedback Loop:**
  - When child video metrics arrive from `social.analytics.feedback_evaluated`:
    - If Child Hook Score > Parent Hook Score by $\ge 15\%$, mark as `PROMOTED_OFFSPRING`.
    - Automatically record winning gene pattern into `creative_memory`.
    - Prune arms that underperform after 500 impressions.

---

## 4. Edge & Serverless Constraints (Cloudflare Workers + D1)
- Compute budget: Mutation logic must be deterministic and pure TypeScript (no heavyweight native ML runtimes on edge).
- D1 Storage: Single migration table `creative_mutations` with compound index on `(parent_job_id, generation, created_at DESC)`.
- Autonomous Execution: Multi-step background workflow orchestrated via Inngest.
