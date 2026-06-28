# Research Report: Affiliate Discovery Algorithms & Architecture
**Date:** 2026-02-05
**Context:** Phase 2 Auto-Discovery Engine
**Focus:** Algorithms, Integrations, Data Sourcing, Ranking

## 1. Executive Summary
The optimal architecture for Sophia's Auto-Discovery Engine is a **Hybrid Batch-Index System**. Relying solely on real-time API calls to networks during user queries is not viable due to rate limits and latency. Instead, we must ingest data into a unified "Sophia Index" (Batch), calculate a normalized "Sophia Score" for ranking, and perform real-time validity checks only at the edge (User View).

## 2. Filtering & Ranking Algorithms
Networks use proprietary metrics (ClickBank "Gravity" vs ShareASale "Power Rank"). To generate a "Top 50" list, we must normalize these into a single **Sophia Potential Score (SPS)**.

### The Sophia Potential Score (SPS) Formula
$$SPS = (w_1 \cdot N_{comm}) + (w_2 \cdot N_{pop}) + (w_3 \cdot N_{rel})$$

*   **$N_{comm}$ (Normalized Commission):** Projected earnings per sale (High-ticket weighted).
*   **$N_{pop}$ (Normalized Popularity):**
    *   *ClickBank:* Logarithmic scaling of Gravity.
    *   *ShareASale:* Inverse of Power Rank (1 = 100pts).
    *   *Amazon:* Sales Rank / Review Count velocity.
*   **$N_{rel}$ (Reliability/EPC):** Earnings Per Click (EPC) consistency over 30 days.

**Filter Pattern Recommendation:**
1.  **Hard Filters:** Category (mapped to unified taxonomy), Min Commission %.
2.  **Soft Sorting:** SPS Score.

## 3. Network Integrations & Constraints

| Network | API Method | Key Metric | Rate Limits / Constraints |
| :--- | :--- | :--- | :--- |
| **Amazon Associates** | PA-API 5.0 | Sales Rank | **Strict.** Limit linked to generated revenue. Start with 1 TPS. Throttling is the main bottleneck. |
| **ClickBank** | REST API | Gravity | Generous. Marketplace feed available as XML/JSON for bulk ingestion. |
| **ShareASale** | REST API | Power Rank | Requires merchant approval for some data. API tokens expire. Limit ~200 calls/min. |

**Strategy:**
*   **ClickBank:** Download daily Marketplace Feed (XML/JSON) $\rightarrow$ Ingest to DB.
*   **ShareASale:** Iterator pattern to fetch top 500 merchants per category $\rightarrow$ Ingest.
*   **Amazon:** **Do not crawl.** Use PA-API only for targeted lookup or "SearchItems" with specific keywords. Cache aggressively (24h).

## 4. Data Sourcing Strategy: Hybrid Model

### A. Primary: Official APIs (The "White Hat" Foundation)
*   **Pros:** Compliant, structured, real-time pricing.
*   **Cons:** Rate limits, fragmentation.
*   **Verdict:** MUST use for Core Data (Price, Name, Link) to remain TOS compliant, especially for Amazon.

### B. Secondary: Aggregation/Scraping (Gap Filling)
*   **Use Case:** Getting metadata not in API (e.g., "Landing Page conversion clues", "Video Sales Letter existence").
*   **Verdict:** Use headless browsers (Playwright) *only* to analyze the destination landing page for quality scoring, not to scrape the network listing itself.

## 5. Architecture: Real-time vs. Batch

**Recommendation: T-Minus 24h Indexing**
1.  **Ingestion Layer (Batch):**
    *   Cron jobs run nightly.
    *   Fetch Data Feed (ClickBank) / Iterate Categories (ShareASale).
    *   Update `products` table in Postgres/Supabase.
2.  **Scoring Layer (Batch):**
    *   Calculate SPS for all updated items.
    *   Tag "Top 50" candidates.
3.  **Discovery Layer (Real-time):**
    *   User searches "Golf swing".
    *   App queries local Supabase `products` table (instant).
    *   **Edge Check:** App performs a "live check" (Head request) on the top 3 links to ensure they aren't 404s before displaying.

## 6. "Top 50" Ranking Methodology (Option B)
To support the "Option B" pricing model (pay for curated access), the ranking must privilege **Success Probability** over **Volume**.

**The "Hidden Gem" Boost:**
*   Identify high-commission ($50+) items with *rising* Gravity/Rank (Velocity > 0) but low absolute saturation.
*   **Algorithm:** If $Gravity < 50$ AND $Gravity_{30d\_slope} > 20\%$, Apply 1.5x Multiplier.

## 7. Unresolved Questions
1.  **Amazon Access:** Do we have an active Associates account with qualifying sales to unlock PA-API? (Without 3 sales, API is blocked).
2.  **Category Mapping:** Need a "Rosetta Stone" JSON mapping ClickBank categories to Amazon Nodes.
3.  **Legal:** Does scraping ShareASale landing pages violate their specific TOS regarding automated analysis?

## Sources
*   [Amazon PA-API 5.0 Documentation](https://webservices.amazon.com/paapi5/documentation/)
*   [ClickBank API Reference](https://api.clickbank.com/rest/v1.3/marketplace)
*   [ShareASale API Developer Guide](https://www.shareasale.com/info/apiDoc.pdf)
