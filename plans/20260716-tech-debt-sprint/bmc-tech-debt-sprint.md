# Business Model Canvas — Y3 Technical Debt Sprint

**Date:** 2026-07-16
**Context:** Sophia AI Factory — PMF→Early Scale stage
**Purpose:** Internal engineering investment

---

## 1. Value Propositions

**Internal (Engineering Team)**
- **Ship faster with confidence:** Elimination of deployment risk from migration chaos. Every migration apply becomes deterministic.
- **Architecture discipline at scale:** Layer enforcement prevents cross-layer imports that create circular dependencies.
- **Reduced onboarding friction:** New engineers/agents understand the codebase faster with clean docs.

**External (Customer-Facing Impact)**
- **99.9% deployment reliability:** Direct impact — fewer production incidents means stable service for non-tech CEO clients.
- **Faster feature delivery:** Tech debt cleared = bandwidth for revenue-generating features.

---

## 2. Customer Segments

| Segment | Profile | Pain Point |
|---------|---------|------------|
| **Primary: Eng Team** | 2-4 engineers + AI agents | Every new migration risks schema conflicts; layer violations accumulate silently |
| **Secondary: AI Agents** | Subagents (Kongming, planner, fullstack-dev) | Need enforced rules to operate autonomously without breaking invariants |
| **Tertiary: Non-tech CEO** | Client wants AI video SaaS without complexity | Indirect: unreliable deployments → trust erosion → churn |

---

## 3. Channels

- Internal execution via `claude --auto` / `/ck:cook`
- CI/CD through CF-direct (no external pipeline)
- Documentation via `docs/` + `CLAUDE.md`

---

## 4. Revenue Streams

**Direct:** None — this is a cost center
**Indirect (Revenue Protection):**
- Prevents production incidents that cost 10+ hours debugging → ~$5K-10K equivalent per incident
- Enables faster shipping of RaaS gateway + billing features → direct revenue impact
- Layman: một production outage = mất khách hàng. Fix tech debt = giữ khách hàng.

---

## 5. Cost Structure

| Cost Type | Amount | Notes |
|-----------|--------|-------|
| **Engineer time** | 14-19 hours | ~2-3 engineer-days, one sprint |
| **Staging D1 compute** | $0 | CF Workers D1 included in plan |
| **CI time** | +2min/build | Layer check adds negligible overhead |
| **Tooling** | $0 | Uses existing ESLint + bash |
| **Opportunity cost** | Delays 1-2 features | Marginal — debt compounds |

---

## 6. Key Resources

- Existing codebase with 10 ADRs and 4-layer model
- ESLint infrastructure (already configured)
- D1 staging database for migration verification
- Sophia Factory AI agents for parallel execution

---

## 7. Key Activities

1. Audit migration files + compare to D1 applied state
2. Consolidate to single source of truth
3. Build layer enforcement script + CI integration
4. Archive stale docs + resolve conflicts
5. Verify via full CI gate (build, test, typecheck)

---

## 8. Key Partnerships

- Cloudflare (D1, Workers) — deploy target
- Inngest — async workflows (not directly touched)
- GitHub — version control for migration tracking

---

## 9. Customer Relationships

- Self-service: Changes merge via PR, CI gate enforces quality
- High-trust: Non-tech CEO relies on stability; engineering team owns reliability

---

## Summary

This sprint is **investment, not product.** ROI is measured in:
- Prevented production incidents (reliability)
- Faster feature velocity (debt cleared)
- Agent operational safety (autonomous execution)

**Bottom line:** Pay $14-19h now, or pay 10x later when migrations break production.
