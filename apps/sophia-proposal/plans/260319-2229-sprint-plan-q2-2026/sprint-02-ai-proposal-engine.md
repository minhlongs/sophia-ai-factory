---
title: "Sprint 2 — AI Proposal Text Engine"
description: "Week 3-4: Core product - AI-powered proposal generation"
phase: Market Validation
priority: P1
effort: 2 weeks
status: completed
created: 2026-03-19
updated: 2026-03-20
---

# SPRINT 2 — AI PROPOSAL TEXT ENGINE

**Dates:** Week 3-4 (2026-04-06 to 2026-04-19)
**Owner:** CTO / AI Engineer
**Target:** Generate proposal in <30s with 80%+ quality score

---

## Context Links

- Strategy: `../../reports/studio/strategy/SUMMARY.md`
- Technical Roadmap: `../../reports/studio/strategy/technical-roadmap.md`
- Sprint 1 Output: `./sprint-01-auth-onboarding.md`
- Claude API Docs: https://docs.anthropic.com/claude/reference

---

## Overview

**Priority:** P1 (Core Product Moat)
**Status:** Pending
**Effort:** 2 weeks

This sprint builds the core differentiator: AI-powered proposal generation. The quality and speed of proposal generation directly impacts customer conversion and retention.

---

## Key Insights

From execution-plan.md:
- **Quality Target:** 80%+ score from pilot users
- **Speed Target:** <30s generation time
- **Risk:** If quality <70%, product is unusable

---

## Requirements

### Functional Requirements

| ID | Requirement | Priority |
|----|-------------|----------|
| FR2.1 | Users can input client/company details | P1 |
| FR2.2 | Users can select proposal template | P1 |
| FR2.3 | AI generates proposal content from inputs | P1 |
| FR2.4 | Users can edit generated content | P1 |
| FR2.5 | Export proposal to PDF | P1 |
| FR2.6 | Save proposal drafts | P1 |
| FR2.7 | View proposal history | P2 |

### Non-Functional Requirements

| ID | Requirement | Target |
|----|-------------|--------|
| NFR2.1 | Generation latency | <30s for full proposal |
| NFR2.2 | Quality score | >80% from pilot users |
| NFR2.3 | Token efficiency | <50K tokens per proposal |
| NFR2.4 | Content accuracy | No hallucinated facts |
| NFR2.5 | PDF quality | Professional formatting |

---

## Architecture

### AI Proposal Generation Flow

```
┌─────────────────────────────────────────────────────────┐
│  1. User Input (Form/Template)                          │
│     - Client name, industry, pain points                │
│     - Proposed solution, timeline, budget               │
└─────────────────────┬───────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────┐
│  2. Prompt Engineering Layer                            │
│     - Industry context injection                        │
│     - Value proposition framework                       │
│     - Tone/style customization                          │
└─────────────────────┬───────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────┐
│  3. LLM Generation (Claude API)                         │
│     - Executive summary                                 │
│     - Solution architecture                             │
│     - Timeline & pricing                                │
│     - Case studies                                      │
└─────────────────────┬───────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────┐
│  4. Content Structuring                                 │
│     - Convert to slide deck JSON                        │
│     - Add speaker notes                                 │
│     - Mark visual cues for video (Phase 2)              │
└─────────────────────┬───────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────┐
│  5. PDF Export                                          │
│     - Professional formatting                           │
│     - Brand customization                               │
│     - Download/stream                                   │
└─────────────────────────────────────────────────────────┘
```

### Prompt Template Structure

```typescript
interface ProposalPrompt {
  system: string;
  user: {
    clientInfo: {
      name: string;
      industry: string;
      painPoints: string[];
      goals: string[];
    };
    solutionInfo: {
      description: string;
      timeline: string;
      investment: string;
      deliverables: string[];
    };
    companyInfo: {
      name: string;
      caseStudies: CaseStudy[];
      differentiators: string[];
    };
    tone: 'professional' | 'friendly' | 'technical';
    length: 'short' | 'medium' | 'long';
  };
}

const SYSTEM_PROMPT = `You are an expert proposal writer for digital agencies.
Generate compelling, client-focused proposals that:
1. Lead with client pain points and desired outcomes
2. Present solutions in business value terms, not technical features
3. Include specific timelines and deliverables
4. Reference relevant case studies
5. End with clear next steps and call-to-action

Tone: Professional yet approachable
Format: Markdown with clear section headers
Length: 2000-3000 words for standard proposal`;
```

### Data Model (Sprint 2 Tables)

```sql
-- Proposal Templates
proposal_templates (
  id uuid primary key,
  org_id uuid references organizations(id),
  name text not null,
  industry text,
  prompt_template jsonb not null,
  sections jsonb not null,
  is_system boolean default false,
  created_at timestamptz default now()
)

-- Proposals
proposals (
  id uuid primary key,
  org_id uuid references organizations(id),
  template_id uuid references proposal_templates(id),
  client_name text not null,
  client_company text,
  client_email text,
  status text not null default 'draft',
  input_data jsonb not null,
  generated_content jsonb,
  quality_score numeric,
  generated_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
)

-- Proposal Sections (for granular editing)
proposal_sections (
  id uuid primary key,
  proposal_id uuid references proposals(id),
  section_key text not null,
  section_title text not null,
  content text,
  ai_generated boolean default true,
  edited_at timestamptz,
  created_at timestamptz default now()
)

-- Proposal Metrics (for analytics)
proposal_metrics (
  id uuid primary key,
  proposal_id uuid references proposals(id),
  views integer default 0,
  clicks integer default 0,
  time_to_generate_ms integer,
  quality_score numeric,
  converted_at timestamptz,
  created_at timestamptz default now()
)
```

---

## Related Code Files

### Files to Create

```
app/
├── (dashboard)/
│   ├── proposals/
│   │   ├── page.tsx                   # Proposal list
│   │   ├── new/
│   │   │   └── page.tsx               # New proposal wizard
│   │   └── [id]/
│   │       ├── page.tsx               # Proposal detail/editor
│   │       └── preview/
│   │           └── page.tsx           # PDF preview
│   └── templates/
│       └── page.tsx                   # Template library

app/api/
├── proposals/
│   ├── route.ts                       # GET/POST proposals
│   └── [id]/
│       ├── route.ts                   # GET/PUT/DELETE proposal
│       ├── generate/
│       │   └── route.ts               # POST /api/proposals/[id]/generate
│       └── export/
│           └── route.ts               # POST /api/proposals/[id]/export
├── templates/
│   ├── route.ts                       # GET/POST templates
│   └── system/
│       └── route.ts                   # GET system templates

lib/
├── ai/
│   ├── client.ts                      # Claude API client
│   ├── prompt-builder.ts              # Build prompts from inputs
│   ├── templates/
│   │   ├── system-proposal.ts         # System prompt template
│   │   ├── agency-proposal.ts         # Agency-specific template
│   │   └── ecommerce-proposal.ts      # Ecommerce template
│   └── quality-check.ts               # Validate AI output quality
├── pdf/
│   ├── generator.ts                   # PDF generation logic
│   └── styles.ts                      # PDF styling constants
└── validators/
    ├── proposal.ts                    # Zod schemas for proposals
    └── template.ts                    # Zod schemas for templates

components/
├── proposals/
│   ├── proposal-list.tsx
│   ├── proposal-card.tsx
│   ├── proposal-editor.tsx
│   ├── proposal-form.tsx
│   ├── ai-generate-button.tsx
│   ├── section-editor.tsx
│   └── pdf-preview.tsx
├── templates/
│   ├── template-grid.tsx
│   ├── template-card.tsx
│   └── template-selector.tsx
└── shared/
    ├── loading-state.tsx
    └── error-boundary.tsx

tests/
├── ai/
│   ├── prompt-builder.test.ts
│   ├── quality-check.test.ts
│   └── generation.test.ts
├── api/
│   ├── proposals.test.ts
│   └── templates.test.ts
└── components/
    ├── proposal-editor.test.tsx
    └── ai-generate-button.test.tsx
```

### Files to Modify

```
lib/
└── supabase/
    └── client.ts                      # Add new table types

.env.local                             # Add Claude API key
```

---

## Implementation Steps

### Week 3: AI Generation Core

**Day 11-12: Prompt Engineering**

1. Research winning proposal structures (50+ samples)
2. Define section templates (exec summary, solution, timeline, pricing)
3. Build prompt builder with variable injection
4. Test prompts manually with Claude API

**Day 13-14: API + Database**

1. Create proposals, proposal_sections tables
2. Build `/api/proposals` CRUD endpoints
3. Implement `/api/proposals/[id]/generate` endpoint
4. Add rate limiting (10 generations/hour per org)

**Day 15: Template System**

1. Create proposal_templates table
2. Build 3 system templates (Agency, SaaS, Ecommerce)
3. Build template selector component
4. Add template preview

### Week 4: Editor + Export

**Day 16-17: Proposal Editor**

1. Build rich text editor for sections
2. Implement AI regenerate per section
3. Add version history (store each generation)
4. Build save draft functionality

**Day 18-19: PDF Export**

1. Integrate PDF generation library (react-pdf or puppeteer)
2. Design professional PDF template
3. Build `/api/proposals/[id]/export` endpoint
4. Add download/stream functionality

**Day 20: Quality + Testing**

1. Implement quality scoring (completeness, coherence)
2. Run 20 test proposals through quality check
3. Optimize prompts based on quality feedback
4. Full end-to-end testing

---

## Todo List

### Week 3 — ✅ COMPLETED (2026-03-20)

- [x] Research winning proposal structures
- [x] Define section templates
- [x] Build prompt builder
- [x] Test prompts with Claude API (mock)
- [x] Create database tables (schema defined)
- [x] Build CRUD endpoints
- [x] Implement generate endpoint
- [x] Add rate limiting
- [x] Create system templates (3: Agency, SaaS, Ecommerce)
- [x] Build template selector

### Week 4 — In Progress

- [x] Build proposal editor
- [x] Add section regeneration
- [ ] Implement version history
- [x] Add save draft
- [x] Integrate PDF library
- [x] Design PDF template
- [ ] Build export endpoint (API route)
- [x] Implement quality scoring
- [x] Run quality tests (8/8 passing)
- [ ] Optimize prompts (needs real API test)

---

## Success Criteria

| Criteria | Target | Measurement |
|----------|--------|-------------|
| Generation speed | <30s | Time from click to complete |
| Quality score | >80% | Pilot user ratings |
| Template coverage | 3+ templates | Agency, SaaS, Ecommerce |
| Edit flexibility | Per-section | Can regenerate any section |
| PDF quality | Professional | Visual inspection + download test |

### Validation Commands

```bash
# Test proposal generation
curl -X POST http://localhost:3000/api/proposals/123/generate \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"template_id": "template-1"}'

# Test PDF export
curl -X POST http://localhost:3000/api/proposals/123/export \
  -H "Authorization: Bearer $TOKEN" \
  -o proposal.pdf

# Quality check script
npm test -- tests/ai/quality-check.test.ts
```

---

## Risk Assessment

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| AI quality <80% | Medium | Critical | Human-in-loop review, iterate prompts |
| Generation >30s | Low | High | Stream response, progress indicator |
| Token costs too high | Medium | Medium | Optimize prompts, cache templates |
| PDF formatting broken | Low | Medium | Use proven library, test extensively |
| Hallucinated content | Medium | High | Fact-checking layer, user review |

---

## Security Considerations

### Input Validation

- Sanitize all user inputs before sending to LLM
- Validate template schemas with Zod
- Rate limit generation endpoints

### Data Protection

- Store proposal content encrypted at rest
- Redact sensitive client data from logs
- Organization isolation via RLS

### AI Safety

- Add content moderation filter
- Block harmful/inappropriate outputs
- Allow users to flag problematic content

---

## Next Steps

**Dependencies for Sprint 3:**

1. Proposal generation must be stable before billing integration
2. Quality score >80% required for pilot onboarding
3. PDF export needed for customer deliverables

**Blockers to Resolve:**

- Claude API rate limits (upgrade if needed)
- PDF library selection (react-pdf vs puppeteer)

---

_Document Version: 1.0.0_
_Created: 2026-03-19_
_Owner: CTO / AI Engineer_
_Next Review: Sprint 2 Retro (2026-04-19)_
