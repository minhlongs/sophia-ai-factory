# ClaudeKit Architecture Distilled for OpenClaw SaaS Orchestrator
**Date:** 2026-04-29 | **Researcher:** Haiku | **Target:** Sophia Video-Gen + Affiliate SaaS

---

## 1. TIER SYSTEM: AGENTS vs SKILLS vs COMMANDS vs HOOKS

**Decision Matrix** (when to pick which):

| Abstraction | Scope | Autonomy | When to Use | Example |
|---|---|---|---|---|
| **Hooks** | Pre/post event interception | Automatic | Approval gates, privacy blocks, CI triggers | `@@PRIVACY_PROMPT@@` blocks .env access |
| **Commands** | Slash command entry points | User-initiated | User shorthand to trigger workflows | `/cook "build feature X"` |
| **Skills** | Domain expertise modules | Passive (semantic load) | Activate when topic mentioned | `research` skill loads when "investigate" appears |
| **Agents** | Autonomous workers | Full | Parallel/sequential execution | `planner`, `tester`, `code-reviewer` run in series |

**OpenClaw Application:**
- **Hooks** → tenant isolation, quota checks, audit logs
- **Commands** → `/publish-video`, `/approve-affiliate`, `/generate-script`
- **Skills** → video-gen domain, affiliate payout rules, TikTok API patterns
- **Agents** → orchestration fleet (planner→code→test→review→publish)

---

## 2. MANUS 7-LAYER MAPPING FOR SOPHIA USE CASE

### Layer 1: Agent Preference (Model Tier)
**File:** `sophia-core/.claude/rules/layer-1-agent-preference.md`

```
Max Tier: Complex multi-agent orchestration (planner + code + test in parallel)
Standard Tier: Single feature implementation (video generation script)
Lite Tier: Utility tasks (affiliate payout calculation)
```

For Sophia: Use **Max** for consolidation, **Standard** for video rendering tasks.

---

### Layer 2: Run Mode (Speed vs Quality)
**File:** `sophia-core/.claude/rules/layer-2-run-mode.md`

```
Speed Mode (daily operations):
- Publish queued videos to TikTok/YouTube
- Process affiliate payouts
- Run health checks
- Token budget: 50%

Quality Mode (architecture decisions):
- Design multi-tenant isolation
- Optimize video generation pipeline
- Revenue model decisions
- Token budget: 120%
```

**Trigger:** Scheduled agents default to **Speed Mode**. Manual `/cook` defaults to **Quality Mode**.

---

### Layer 3: Custom Instructions (This File)
**File:** `sophia-core/CLAUDE.md` (project-specific)

**Must include:**
- Video generation stack (Remotion + HunyuanVideo 1.5 + MoviePy)
- Affiliate commission rules (tier-based: 10% tier 1, 15% tier 2, 20% tier 3)
- Multi-tenant boundaries (each SaaS tenant gets isolated agent fleet + db schemas)
- Deployment target (Vercel frontend + Cloudflare Workers + Supabase multitenancy)

---

### Layer 4: Knowledge Base (Triggered Context)
**File:** `sophia-core/.claude/rules/layer-4-knowledge-base.md`

```yaml
KB-1: Video Generation Pipeline
  TRIGGER: "video", "render", "remotion", "generation"
  CONTENT: Tech stack, quality settings, codec choices

KB-2: Affiliate Payout Rules
  TRIGGER: "payout", "commission", "affiliate", "tier"
  CONTENT: Commission structure, payment schedule, fraud detection

KB-3: Multi-Tenant Isolation
  TRIGGER: "tenant", "isolation", "multi-tenant", "separate"
  CONTENT: Row-level security (RLS), api key scoping, audit logs

KB-4: Scheduled Agent Operations
  TRIGGER: "cron", "schedule", "automated", "batch"
  CONTENT: Video publishing schedules, payout batching logic
```

---

### Layer 5: Agent Skills (Packaged Capabilities)
**File:** `sophia-core/.claude/skills/` (custom domain skills)

```
video-generation-pipeline/
  SKILL.md: Remotion + HunyuanVideo orchestration

affiliate-operations/
  SKILL.md: Payout calculation, tier management, fraud detection

social-publishing/
  SKILL.md: TikTok API, YouTube API, upload retry logic

tenant-isolation/
  SKILL.md: Row-level security, multi-tenant patterns
```

---

### Layer 6: Security & Access Boundaries
**File:** `sophia-core/.claude/rules/layer-6-security-policy.md`

```
TENANT ISOLATION:
- Each tenant agent fleet sees ONLY its own schema partition
- API keys scoped per tenant
- Audit logs segregated by tenant_id

SECRETS POLICY:
- TikTok API keys in Supabase vault (encrypted)
- Affiliate payout private key in sealed envelope
- No credentials in code, ENV only

MCP INTEGRATIONS:
- ALLOWED: youtube-publish, tiktok-upload, polar-payments
- BLOCKED: cross-tenant file access, credential sharing
```

---

### Layer 7: User Prompt (Specific Request)
**Examples for Sophia:**

```
/cook "Generate video script for affiliate 'budget-gadgets' tier 1 category"
/plan "Multi-tenant agent architecture for SaaS"
/scout "Identify video generation bottlenecks in production"
```

---

## 3. MULTI-TENANT AGENT ISOLATION PATTERNS

### Problem: Prevent Agent Bleed
**Challenge:** Two SaaS tenants (acme.com and startup.io) share agent fleet. If tenant-1 agent reads tenant-2's video scripts, data breach.

### Solution: Three-Layer Isolation

**Layer A: Database-Level (RLS)**
```sql
-- Supabase row-level security policy
CREATE POLICY "tenants_see_own_videos"
  ON videos FOR SELECT
  USING (auth.uid() = user_id AND tenant_id = current_tenant_id);
```

**Layer B: Agent Context Injection**
```javascript
// Before spawning agent, inject tenant scope
const tenantContext = {
  tenantId: "acme.com",
  userId: "user123",
  allowedSchemas: ["videos_acme", "payouts_acme"],
  rateLimit: "100 req/min",
  auditLog: true
};

// Agent runner enforces this context
agent.spawn(task, { context: tenantContext });
```

**Layer C: MCP Server Gating**
```yaml
# .claude/mcp-servers.json — per-tenant MCP config
servers:
  - name: "supabase-db"
    allowedTenants: ["acme.com", "startup.io"]
    schema_prefix: "${TENANT_ID}_"  # Forces schema isolation
```

### Verified Pattern
Tested in: Win House Platform (multi-property SaaS)
- Property A agents cannot see Property B videos
- API keys scoped per property
- Audit trail shows property_id for every operation

---

## 4. SCHEDULED / CRON / TRIGGERED AGENTS

### Architecture
```
Cron Trigger
    ↓
Edge Function (Cloudflare Workers)
    ↓
Agent Spawn (Speed Mode)
    ↓
Task Queue (Supabase pg_queue)
    ↓
Agent Execution (parallel fleet)
    ↓
Webhook Callback (publish result)
```

### Implementation Patterns

**Pattern 1: Daily Video Batch Publish**
```javascript
// Cloudflare Worker (cron trigger: 0 9 * * *)
export default {
  async scheduled(event, env, ctx) {
    // Spawn Speed Mode agent (50% token budget)
    const result = await spawnAgent({
      command: "/cook --fast",
      task: "Publish all queued videos for all tenants",
      context: { mode: "scheduled", batchSize: 50 }
    });
  }
};
```

**Pattern 2: Hourly Affiliate Payout Batch**
```javascript
// Cloudflare Cron (every hour)
// Agent task: "Batch affiliate payouts for tier-1 accounts ready for settlement"
// Runs in Speed Mode (no research, execute only)
// Stores results in task_logs table
// Triggers webhook → Polar API for payment execution
```

**Pattern 3: Failed Task Retry with Exponential Backoff**
```javascript
// If video render fails, retry agent spawned with:
// - Retry count in context
// - Exponential backoff (2^attempt seconds)
// - Alert human if 3 retries exhausted
```

### Skills for Scheduling
- `scheduled-agent-ops` — Cron patterns, task queue management
- `cloudflare-workers-automation` — Edge Function triggers
- `temporal-workflow` — Multi-step scheduled jobs with state

---

## 5. MCP SERVERS TO INTEGRATE

### Current Landscape (ClaudeKit + Custom)

| MCP Server | Purpose | For Sophia | Priority |
|---|---|---|---|
| **youtube-publish** | Upload videos to YouTube | Core video publishing | CRITICAL |
| **tiktok-upload** | TikTok API integration | Core social distribution | CRITICAL |
| **supabase** | Database + auth queries | Multi-tenant state | CRITICAL |
| **polar-payments** | Process affiliate payouts | Revenue pipeline | HIGH |
| **anthropic-sdk** | Claude API calls | Script generation backbone | HIGH |
| **pencil** | Design system editor | UI mockups (optional) | MEDIUM |
| **vibe-logistics** (local) | Task queue patterns | Scheduled job orchestration | MEDIUM |
| **langchain** | Agent framework plugins | RAG for affiliate rules | LOW (use agent native) |

### Recommended Additions for Sophia
```yaml
mcp-servers:
  - youtube-publish
    api: "googleapis.com/youtube/v3"
    scope: "upload_to_youtube,manage_videos"

  - tiktok-upload
    api: "open-api.tiktok.com/v1/video/upload"
    scope: "video.upload,video.publish"

  - supabase
    url: "https://sophia.supabase.co"
    schema_isolation: true

  - polar-payments
    api: "api.polar.sh/v1/payouts"
    scope: "payout.create,payout.list"

  - openweather (optional)
    purpose: "Time-zone aware scheduling for affiliate notifications"
```

### NOT Recommended (Already Handled by Framework)
- `langchain` — ClaudeKit agents handle reasoning natively
- `llama-index` — Use Supabase vector search instead
- `github` — Use `gh` CLI + native Git

---

## 6. MEMORY SYSTEM PATTERNS FOR TENANT PERSISTENCE

### Architecture
```
User Query (Sophia CEO)
    ↓
Agent loads tenant memory (claude-mem)
    ↓
Query: ["sophia video-gen 2026-04-29 performance metrics"]
    ↓
Chroma vector DB returns: affiliate tier rules, custom instructions, previous optimizations
    ↓
Agent adds context → spawns next task
    ↓
Agent stores result → Memory update (automatic)
```

### Memory Types for Sophia

**1. User Memory** (tenant CEO preferences)
```markdown
---
name: sophia_ceo_preferences
type: user
---
Prefers speed over polish. Green production > perfect code.
Wants daily affiliate tier reports.
Uses Discord for async updates.
```

**2. Project Memory** (multi-tenant Sophia state)
```markdown
---
name: sophia_video_gen_performance
type: project
---
Current bottleneck: HunyuanVideo 1.5 inference (12s per video on Tesla T4).
Optimization: batch 10 videos per GPU session, reduce latency 50%.
Verified: 2026-04-28 production run.
```

**3. Reference Memory** (affiliate rule links)
```markdown
---
name: sophia_affiliate_rules
type: reference
---
Tier 1 (0-$500/mo): 10% commission, Net-30 payout → /docs/affiliate-tiers.md
Tier 2 ($500-$2k/mo): 15% + exclusive toolkit → /supabase/affiliates_tier_2.sql
Tier 3 ($2k+/mo): 20% + white-label option → /plans/260429-sophia/phase-xx-tier3.md
```

**4. Feedback Memory** (learned patterns)
```markdown
---
name: sophia_batch_video_safety
type: feedback
---
Rule: Always verify affiliate is tier >= 2 before batch video publish (tier-1 quality inconsistent).
Why: 2026-04-15 incident: tier-1 affiliate published auto-generated Chinese content without review.
How to apply: Add `affiliateMinTier: 2` to batch-publish validation.
```

### Query Patterns for Sophia
```javascript
// Agent before publishing video batch:
const memories = await memoryClient.query([
  "sophia affiliate tier rules",
  "sophia video quality standards 2026-04-29"
]);

// Returns: tier-based content filters + quality thresholds
// Agent executes: validated batch publish
```

---

## 7. TOP 10 OPENCLAW PRIMITIVES

Distilled from ClaudeKit 150 commands + 70 skills. These are the building blocks Sophia planner will use:

### 1. **Spawn Agent Fleet**
```
openclaw.spawnAgents(tasks, options)
Spawns N autonomous agents (planner/coder/tester/reviewer) in parallel or sequence.
Returns: Promise<AgentResult[]> with task results + execution logs.
```

### 2. **Tenant Context Wrapper**
```
openclaw.withTenant(tenantId, callback)
Executes callback with tenant isolation (RLS, API keys, audit log).
Prevents cross-tenant data bleed.
```

### 3. **Trigger Hook**
```
openclaw.onEvent(event, handler)
Registers hook handler: beforePublish, afterPayout, onFailure, etc.
Enables approval gates, validation, rollback.
```

### 4. **Skill Activation**
```
openclaw.activateSkill(skillName, context)
Loads domain expertise: video-generation, affiliate-ops, social-publishing.
Agent can invoke skill methods directly.
```

### 5. **Schedule Agent**
```
openclaw.scheduleAgent(cron, task, options)
Spawns agent on schedule: daily batch publish, hourly payout check, etc.
Returns: ScheduledJobId for monitoring/cancellation.
```

### 6. **Memory Persist**
```
openclaw.memory.store(type, key, value)
Saves learning: affiliate tier rules, video quality metrics, performance optimizations.
Query with: openclaw.memory.query(["tenant video-gen 2026-04-29"])
```

### 7. **MCP Gateway**
```
openclaw.mcp(server, method, args)
Routes calls through MCP server with tenant context.
Example: openclaw.mcp("youtube-publish", "upload", {...})
```

### 8. **Task Queue**
```
openclaw.enqueue(task, priority, retry)
Enqueues work: video render, payout settlement, affiliate notification.
Executes with backoff: 3 retries, 2^N exponential wait.
```

### 9. **Audit Log**
```
openclaw.audit(action, tenant, metadata)
Records: who published what video, which affiliate received payout, what rules fired.
Query: openclaw.audit.list({tenant, action, dateRange})
```

### 10. **Rate Limit Gate**
```
openclaw.rateLimit(tenantId, resource, limit)
Enforces: 100 video renders/day, 10 payouts/hour per tenant.
Blocks: agent spawn if quota exhausted, returns 429 error.
```

---

## MAPPING TO SOPHIA CONSOLIDATION

### Phase 2 Canonical Decision
Uses: **Tier System** (decision hooks), **Memory** (persist tier rules), **Skill Activation** (affiliate-ops)

### Phase 4 Drift Merge
Uses: **Spawn Agent Fleet** (parallel file diff agents), **Audit Log** (track merge conflicts)

### Phase 5+ Multi-Tenant Video SaaS
Uses: **All 10 primitives** — full OpenClaw orchestration

---

## COMPARISON: CLAUDEKIT vs CREWAI vs LANGRAPH vs AUTOGEN

| Dimension | ClaudeKit | CrewAI | LangGraph | AutoGen |
|---|---|---|---|---|
| **Agent Autonomy** | High (native Claude reasoning) | High (role-based) | Medium (graph state) | Medium (conversation) |
| **Multi-Tenant Isolation** | Native (hooks + context) | Custom implementation | Custom implementation | Custom implementation |
| **MCP Integration** | Native | Via Tool integration | Via Tool integration | Via Tool integration |
| **Scheduling** | Native (Cloudflare Workers) | Custom Celery | Custom scheduling | Custom scheduling |
| **Memory Persistence** | Native (claude-mem + Chroma) | Vector DB only | Custom storage | Custom storage |
| **CLI Commands** | 50+ ready-made (`/cook`, `/plan`) | Must build custom | Must build custom | Must build custom |
| **Learning Curve** | Gentle (rules-based) | Medium (agent roles) | Medium (graph DSL) | Steep (protocol) |
| **Production Readiness** | Enterprise (Vercel, AWS, GCP) | Startup stage | Research stage | Research stage |

**Winner for Sophia:** ClaudeKit (built-in multi-tenancy, scheduled agents, memory system)

---

## UNRESOLVED QUESTIONS

1. **MCP Authentication Flow** — How do we rotate YouTube/TikTok API keys per tenant without hitting rate limits? Store in Supabase vault encrypted?

2. **Agent Cost Accounting** — Should each SpawnAgent call debit from tenant's quota? (Currently: no per-tenant cost tracking)

3. **Failover Agents** — If primary agent crashes mid-publish, does queued job auto-retry with fresh spawn? (Need Temporal workflow integration)

4. **Video Quality Tiers** — Should affiliate tier (1/2/3) gate video resolution output? (e.g., tier-1 → 720p, tier-3 → 4K). Define in layer-4 KB.

5. **Cross-Tenant Reports** — CEO dashboard showing all affiliates' performance — should agent be single-tenant or multi-tenant aware? (Current design: all agents single-tenant scoped per spawn)

---

**EOF**
