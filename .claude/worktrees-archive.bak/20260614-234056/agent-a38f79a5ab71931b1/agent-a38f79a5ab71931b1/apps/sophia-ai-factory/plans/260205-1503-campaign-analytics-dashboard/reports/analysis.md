# Analytics & Visualization Options Report

## 1. Requirement Analysis
The goal is to implement a Campaign Analytics Dashboard with:
- Campaign statistics (Total, Success Rate, Avg Completion Time).
- Status distribution chart.
- Performance metrics (Generation time).
- Tier distribution.

## 2. Existing Infrastructure
- **Framework**: Next.js 16.1.6 (App Router).
- **Styling**: Tailwind CSS 4.
- **Database**: Supabase.
- **Libraries**: `recharts` is installed (`^3.7.0`).
- **Data Model**: `Campaign` table has `status`, `created_at`, `updated_at`, `tier` (via User or directly on Campaign if added).

## 3. Data Availability Analysis
- **Total Campaigns**: `count(*)` from `campaigns`.
- **Success Rate**: `count(status='completed') / count(*)`.
- **Avg Completion Time**: `avg(updated_at - created_at)` where `status='completed'`.
- **Status Distribution**: Group by `status`.
- **Tier Distribution**: `Campaign` table does not currently store `tier`. `User` has `tier`. We need to join with `users` table or assuming current user's campaigns are for their tier, or if this is an "Admin" dashboard?
  - *Clarification*: The prompt implies a dashboard for the *user* to see *their* campaigns ("Campaign Analytics Dashboard" usually implies user facing).
  - If it's user-facing, "Tier distribution" doesn't make sense (a user has 1 tier).
  - *Re-reading requirements*: "Tier distribution chart" suggests this might be an **Admin** dashboard or the user has campaigns of different tiers?
  - Or maybe it's "Campaigns per Tier" if campaigns can have tiers?
  - The `ScriptRecord` in types has `tier`, but `Campaign` interface in types doesn't show `tier`.
  - However, the `TierConfig` suggests tiers are user-level.
  - **Assumption**: This is likely a user-facing dashboard. "Tier distribution" might be a misunderstanding of the prompt or it implies looking at data across *all* users (Admin view).
  - *Alternative interpretation*: Maybe the user wants to see which *template tiers* they used?
  - Given "Tier distribution chart" is explicitly asked, and `FeatureFlag` includes `enable_admin_dashboard`, this might be an Admin feature.
  - *Decision*: I will implement it as a User Dashboard first. If "Tier distribution" implies Admin, I'll flag it. But wait, `Campaign` type doesn't have `tier`. `User` has `tier`. If it's a user dashboard, "Tier distribution" is always 100% their current tier.
  - *Correction*: Looking at `src/types/index.ts`, `ScriptRecord` has `tier`. Maybe `Campaign` tracks it?
  - I will assume "Tier distribution" refers to the types of campaigns if applicable, or I will omit it for User Dashboard and add a note. **Actually**, let's assume the user is an **Admin** or the prompt implies aggregated stats.
  - *Safer bet*: Implement the User specific stats. For "Tier distribution", I'll check if I can get it. If not, I'll simplify or skip with a note.
  - *Wait*, "Tier distribution chart" is a specific requirement. Let's look at `User` type: `tier: Tier`.
  - If I am building `/dashboard/analytics`, it is likely for the logged-in user.
  - I will assume this is an **Admin** dashboard feature OR the requirement meant "Campaign Type/Template distribution".
  - I will place it in `/dashboard/analytics` which implies user context. I will build the stats for the *User's* campaigns. I'll add "Tier Distribution" as a placeholder or "Templates Used" distribution which is more useful for a user.
  - *Actually*, let's look at the `FeatureFlag`: `enable_admin_dashboard`. Maybe this IS the admin dashboard?
  - The path `/dashboard/analytics` suggests user dashboard.
  - I will implement "Campaigns by Status" (User).
  - I will implement "Generation Time" (User).
  - For "Tier Distribution", I will check if we can display "Campaigns by Template" instead, or if the user creates campaigns with different "tiers" of quality?
  - I'll stick to the text: "Tier distribution chart". If it's strictly user-facing, maybe it's not relevant. I will implement it as "Campaigns by Type" (Video vs Script only?) if Tier isn't available.
  - *Pivot*: I will implement the analytics for the **current user**.

## 4. Visualization Strategy
- **Library**: Use `recharts` (already in `package.json`).
- **Charts**:
  - **Status**: Pie Chart or Bar Chart.
  - **Time**: Bar Chart (Duration per campaign or Avg per day).
  - **Tier**: Pie Chart (if data exists) or remove if single-user.

## 5. Technical Constraints
- **Step Breakdown**: We only have `created_at` and `updated_at`.
- **Solution**: Calculate total duration. For "Breakdown by step", we will mock the split (e.g. 10% script, 40% voice, 50% video) or just show Total Duration for MVP. The requirements say "Generation time breakdown by step". Without DB columns `script_generated_at`, `voice_generated_at`, this is impossible to know exactly.
- **Plan**: I will add a note to add these columns in the future. For now, I will just show Total Time.

## 6. Layout
- CSS Grid layout.
- Cards for summary metrics.
- Charts in 50% width containers.

