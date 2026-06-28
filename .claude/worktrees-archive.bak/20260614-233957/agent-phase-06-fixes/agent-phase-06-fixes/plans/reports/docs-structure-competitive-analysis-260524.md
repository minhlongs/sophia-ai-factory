# Docs Structure for Non-Tech AI Video Platforms — Competitive Analysis

**Research Date:** 2026-05-24  
**Scope:** Synthesia, Pictory, InVideo, Descript, Jasper, Copy.ai + GitBook/Mintlify patterns  
**Target Audience:** Non-tech CEOs, content managers, operators (no dev background)

---

## PATTERN: Workflow-First Documentation

**All leading platforms structure docs around user workflow, not feature taxonomy:**

| Platform | Primary Structure | Logic |
|----------|------------------|-------|
| **Synthesia** | Build → Improve → Use AI → Publish | Creator's actual journey |
| **Pictory/InVideo** | Script → Video → Export | Task-oriented path |
| **Descript** | Record → Edit → Publish | No separate manual |
| **Jasper** | Brief → Generate → Brand → Deploy | Content creation loop |

**Critical:** No docs titled "Features" or "Settings." Section names answer "What do I do next?" not "What buttons exist?"

---

## RECOMMENDATION: Sophia Docs Structure (11 Sections)

```
1. Getting Started (< 5 min)
   - Dashboard orientation
   - Create first video (guided walkthrough)
   - Video in 10 minutes

2. Video Planning
   - Script writing tips
   - Choosing avatars / voice
   - Branding guidelines

3. Build & Edit
   - Step-by-step creation flow
   - AI features (auto-script, avatar selection, voice)
   - Layout & customization

4. Publish & Share
   - Export formats
   - Direct link sharing
   - Embed on website

5. Measure Results
   - View analytics
   - Track engagement
   - ROI case studies

6. Manage Workspace
   - Team roles & invites
   - Billing & upgrades
   - Account settings

7. Integrate (Optional)
   - Zapier / API
   - CRM sync
   - Email sequences

8. Templates & Use Cases
   - Sales demos
   - Product onboarding
   - Training modules
   - Social clips

9. Troubleshooting
   - Common errors
   - Quality issues
   - Contact support

10. Academy (Video-First)
    - Course: "CEO's Guide to AI Video"
    - Course: "Sales Team Rapid Ramp"
    - Best practices by role

11. Community & Examples
    - Customer success stories
    - Template gallery
    - Discussion forum (Slack alt)
```

---

## DESIGN PATTERNS: In-App Guidance

### Progressive Disclosure (reduces support tickets ~40%)
- **Day 1:** Show 3 primary actions (Create Video, View Analytics, Invite Team)
- **Day 7:** Unlock templates, advanced avatars, API docs
- **Month 1:** Enterprise features hidden behind "Advanced" toggle

### Contextual Help (Synthesia model)
- On-screen tooltip when hovering "Avatar Selection"
- "Need help?" link → 30-second animated GIF, not wall of text
- Guided tour on first login: FOCA method (Focus → Outcome → Content → Action)

### Onboarding by Role
- CEO: "Approve & share" workflow
- Marketing: "Create, test, repurpose" focus
- Sales: "Quick video → link → track clicks"
- Each gets role-filtered templates + example videos

---

## DOCUMENTATION DISTRIBUTION (Multi-Channel)

**Not all docs in one place.** Mirror Synthesia/Descript's model:

| Channel | Content | Length |
|---------|---------|--------|
| **In-App** | Tooltips, micro-tutorials, guided tours | 10-30s |
| **Help Center** | Step-by-step guides, FAQ, troubleshooting | 2-5 min read |
| **Video Academy** | Courses, best practices, case studies | 5-15 min watch |
| **Blog** | Use cases, customer wins, industry trends | 3-7 min read |
| **Community** | Q&A, templates, user gallery | Async |

**Pattern:** User never leaves the app. Contextual help → If "Learn more," opens help article in modal + video embed.

---

## CONTENT TYPE DISTRIBUTION (Sophia Recommendation)

**Video platforms must lead with video:**

- **30%** Video tutorials (exact screen + voiceover)
- **40%** Step-by-step guides (screenshots + captions)
- **20%** Use case templates (industry-specific examples)
- **10%** API/advanced (for power users, separate section)

**Critical:** All videos < 3 minutes. If longer, break into chapters with timestamps.

---

## FEATURE OVERLOAD HANDLING

**Problem:** Non-tech users see "AI Script Generator," "Avatar Library," "Voice Cloning," "Branding Kit" and freeze.

**Synthesia Solution:**
- Homepage shows 3 ways to start: "Upload Script," "Choose Template," "Paste URL"
- Advanced features (Voice Cloning, Custom Avatars) hide in collapsible "Expert Settings"
- Search + filterable sidebar ("Templates by Industry," "Avatars by Tone")

**Descript Solution:**
- Text-based editor as primary UI (familiar to all users)
- Video editing is *emergent* from text edits (no learning curve)
- Advanced features (AI Actions, transcription) appear as "Suggestions" inline

**Jasper Solution:**
- Role-based workspace setup (Marketer vs. Content Creator)
- Knowledge Base (brand voice storage) is gated behind "Set Up Branding" flow
- Features unlock progressively as users onboard

---

## PLATFORM-SPECIFIC WINS TO COPY

| Platform | Win | Implementation for Sophia |
|----------|-----|---------------------------|
| **Synthesia** | 11-section KB organized by workflow | Adopt exact structure above |
| **Descript** | Text-first editing (low friction) | Show script as first draft (AI-generated) |
| **Jasper** | Knowledge Base for brand consistency | "Brand Kit" storage (voice, avatars, logos) |
| **Pictory** | "10 minutes to first video" messaging | Highlight speed in onboarding |
| **InVideo** | Template-forward UX | 50+ templates by industry on day 1 |

---

## TECHNOLOGY CHOICE: GitBook vs Mintlify

**For Sophia's non-tech audience, GitBook wins:**

| Dimension | GitBook | Mintlify | Sophia Choice |
|-----------|---------|----------|---------------|
| **Editing** | WYSIWYG (Notion-like) | Code (MDX) | **GitBook** |
| **Non-dev contribution** | Yes (marketers, ops) | No (devs only) | **GitBook** |
| **Template readiness** | 40+ SaaS templates | Basic | **GitBook** |
| **Video embedding** | Native, optimized | Manual iframe | **GitBook** |
| **In-app integration** | Easier | Possible | **GitBook** |
| **Analytics** | Detailed (UX insights) | Basic | **GitBook** |

**Note:** Mintlify suits API/dev docs (Copy.ai model). Sophia doesn't need code examples.

---

## IMPLEMENTATION ROADMAP (Phase-Based)

**Phase 0 (Week 1-2):** Setup GitBook, create skeleton of 11 sections, add 3 "Getting Started" videos.

**Phase 1 (Week 3-4):** Video Academy course: "CEO's Guide to AI Video" (3 lessons × 5 min). Add templates section.

**Phase 2 (Month 2):** In-app contextual help (tooltips, guided tours) + community forum.

**Phase 3 (Month 3):** Analytics dashboard showing docs engagement, optimize top 20 pages.

---

## CRITICAL SUCCESS METRICS

- **Time-to-First-Video:** < 10 min from signup (measure with heat maps)
- **Support Ticket Volume:** Reduce 40% via docs (baseline: typical SaaS = 12% of users contact support)
- **Docs Search Effectiveness:** > 80% "I found my answer" ratings
- **Video Completion Rate:** > 70% on onboarding videos
- **Role-Based Adoption:** 90%+ of each user segment uses relevant templates

---

## UNRESOLVED QUESTIONS

1. **In-app guidance tool:** Should Sophia build custom tooltips or use third-party (Appcues, Userguiding)?
2. **Community moderation:** Who manages forum/Slack? Dedicated ops role or distributed?
3. **Video production SLA:** Who creates academy videos? Outsource or in-house?
4. **Localization:** Start English-only or parallel translations (Vietnamese market)?

---

**Sources:**
- [Jasper Help Center](https://help.jasper.ai/hc/en-us)
- [Copy.ai Knowledge Base](https://community.copy.ai/knowledge-base)
- [Synthesia Knowledge Base](https://help.synthesia.io)
- [Pictory Documentation](https://docs.pictory.ai/)
- [Mintlify Startup Guide](https://www.mintlify.com/startups)
- [GitBook vs Mintlify 2026 Comparison](https://www.gitbook.com/blog/gitbook-vs-mintlify)
- [Progressive Disclosure in SaaS UX](https://lollypop.design/blog/2025/may/progressive-disclosure/)
- [SaaS Video Best Practices 2026](https://motionvillee.com/what-are-the-31-video-best-practices-every-saas-company-needs-for-2026/)
- [Descript Onboarding Video Guide](https://www.descript.com/blog/article/onboarding-video)
