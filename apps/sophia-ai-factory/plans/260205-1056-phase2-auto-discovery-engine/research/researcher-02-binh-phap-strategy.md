# Research Report: Binh-Pháp Strategic Implementation
**Date:** 2026-02-05
**Focus:** Strategic Implementation Patterns for Auto-Discovery Engine
**Reference:** `plans/260205-1056-phase2-auto-discovery-engine/plan.md`

## 1. Binh-Pháp Phase Mapping (Software Lifecycle)

Mapping *The Art of War* principles to the Auto-Discovery Engine phases ensures systematic victory.

| Chapter | Principle | Software Phase Application |
| :--- | :--- | :--- |
| **I. 始計 (Initial Calculations)** | **Estimation & Planning** | **Phase 1: Infrastructure.** Schema design, normalizing data types across networks. *Victory condition:* Zero schema migrations needed after launch. |
| **II. 作戰 (Waging War)** | **Resource Management** | **Phase 2: Ingestion.** Heavy lifting of data fetching. Focus on efficiency (token usage, API rate limits) and speed. *Key:* Avoid prolonged data fetching wars. |
| **III. 謀攻 (Attack by Stratagem)** | **Winning without Fighting** | **Phase 3: Intelligence Engine.** The "SPS" algorithm. Instead of analyzing *everything* manually, use the algorithm to filter noise. *Goal:* Maximum value, minimum human effort. |
| **IV. 軍形 (Disposition)** | **Invincibility** | **Phase 4: API & Security.** Robust Edge functions. Ensure the system cannot crash under load. Security (RLS) makes the position unassailable. |
| **V. 兵勢 (Energy/Momentum)** | **Force Multipliers** | **Phase 5: Frontend/UX.** The "Top 50" list. Visual impact that converts data into user action. Momentum through fast UI interactions. |

## 2. Weekly Iteration Strategy (戰略節奏 - Strategic Tempo)

Adopt a "Blitzkrieg" tempo to maintain momentum (兵勢).

*   **Monday (始計):** Tech Debt Scan (`/scout`), Review Plan (`/plan`), Define "Victory" for the week.
*   **Tuesday - Wednesday (作戰):** Heavy Implementation (`/cook`). Deep work blocks. Focus on functional core.
*   **Thursday (謀攻):** Optimization & Intelligence. Refine algorithms, improve performance, reduce "friction".
*   **Friday (兵勢 & 虛實):** Polish & Documentation. UX review, update `docs/`, demo to "Customer" (User).
*   **Weekend:** Rest (Do not prolong the campaign).

## 3. Option B Business Model Validation ($1,200 + $100/mo)

**Strategy:** *High Value, Low Volume (The "Gem" Strategy).*
Unlike low-ticket SaaS ($29/mo) requiring volume, Option B relies on delivering **substantial ROI**.

*   **Implication for Engine:** The "Hidden Gem" detection algorithm is the critical asset.
*   **Validation:**
    *   **Metric:** If the engine finds *one* product/month generating >$2,000 profit, the $100/mo fee is trivial.
    *   **Focus:** Filter ruthlessly. Show fewer, higher-quality results rather than a massive directory of junk.

## 4. Resource Allocation: Algorithm vs. UI

**Strategic Split: 60/40**

*   **60% - Intelligence Engine (Filter Algorithm):**
    *   This is the "Secret Weapon" (謀攻).
    *   Without accurate scoring (SPS), the UI is just a pretty wrapper on garbage data.
    *   **Task:** Normalizing "Gravity" (ClickBank) vs "EPC" (ShareASale) into a single unified score.
*   **40% - Top 50 List (UI/Presentation):**
    *   This is the "Marketing" (兵勢).
    *   Must look premium to justify the $1,200 setup fee.
    *   **Task:** High-performance grid, real-time "trending" badges.

## 5. Victory Metrics

Define success not just by "Done" but by tactical superiority.

1.  **Speed (神速):**
    *   Build Time: < 3 minutes.
    *   Ingestion Cycle: < 1 hour for full network update.
2.  **Safety (不敗):**
    *   Test Coverage: 100% on Algorithm logic (SPS calculation).
    *   Type Safety: 0 `any` types in data transformation layer.
3.  **Impact (利益):**
    *   **Gem Ratio:** % of "High Potential" products that are actually profitable (target > 20%).
    *   **System Trust:** User retention on the "Top 50" page.

## Unresolved Questions
1.  How do we normalize "Gravity" (relative rank) against absolute "EPC" (Earnings Per Click) without historical data?
2.  Does the Amazon API allow storing product data for "Discovery" or only transient display? (Compliance check needed).
