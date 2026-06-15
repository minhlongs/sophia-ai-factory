# EU AI Act Compliance Checklist — Article 50

**Version**: 1.0 | **Effective**: 2026-06-12 | **Deadline**: 2026-08-02 (51 days)

⚠️ **CRITICAL**: Sophia AI Factory ships AI content generation. EU customers require Article 50 compliance BEFORE go-live.

---

## Article 50 Summary

EU AI Act Article 50 (Transparency Obligations for Providers and Deployers of AI Systems) becomes enforceable **2 August 2026**. Failure to comply = fines up to €15M or 3% global annual turnover (whichever higher).

---

## Requirements Breakdown

### 50(1) — AI Interaction Disclosure

**Requirement**: Providers shall ensure that AI systems intended to interact directly with natural persons inform those persons that they are interacting with an AI system.

**Sophia applicability**: ✅ Applies — chatbot features, AI generation prompts.

**Implementation**:
- [ ] Banner/notification on first chat message: "You're chatting with Sophia AI Assistant"
- [ ] Visible label on AI-generated output panels
- [ ] Disclosure language in Terms of Service (already in v1.0)

---

### 50(2) — Synthetic Content Marking

**Requirement**: Providers of AI systems generating synthetic audio, image, video, or text content shall ensure that outputs are marked in a **machine-readable format** and detectable as artificially generated or manipulated.

**Sophia applicability**: ✅ Applies — text, image, video generation features.

**Implementation**:
- [ ] C2PA metadata embedding in generated images (`src/land/content/ai-watermark.ts`)
- [ ] C2PA metadata in generated video assets
- [ ] Watermark marker in AI-generated text (invisible + machine-readable)
- [ ] Manifest URL embedded for downstream verification

**Status**: 🔄 Implementation pending Phase 1 (see `src/land/content/ai-watermark.ts`)

---

### 50(3) — Deepfake Disclosure

**Requirement**: Deployers of an AI system generating or manipulating image, audio, or video content constituting a deepfake shall disclose that the content has been artificially generated or manipulated.

**Sophia applicability**: ⚠️ Conditional — if feature enables deepfake creation.

**Implementation**:
- [ ] Default opt-in disclosure on AI-generated video output
- [ ] Disclosure language pre-filled in publishing templates
- [ ] User prompt warning before generating synthetic human likeness

**Status**: 🟡 To be confirmed by CEO — does product support deepfake generation?

---

### 50(4) — Public Interest Text Disclosure

**Requirement**: Deployers of an AI system generating text published with the purpose of informing the public on matters of public interest shall disclose that the text has been artificially generated or manipulated.

**Sophia applicability**: ⚠️ Conditional — if customer uses SaaS to publish news, journalism, or public-interest content.

**Implementation**:
- [ ] Workflow tag for "public interest content"
- [ ] Forced disclosure if tag applied
- [ ] Named responsible person/entity requirement (customer fills in)

**Status**: 🟡 Optional workflow — flag in publishing UI

---

## Implementation Plan

### Week 1 (now → 2026-06-19)

- [ ] Implement `src/land/content/ai-watermark.ts` — C2PA embedder
- [ ] Wire into all AI generation endpoints
- [ ] Add UI banner for AI chat interaction
- [ ] Update ToS with Article 50 disclosure language

### Week 2 (2026-06-19 → 2026-06-26)

- [ ] Add disclosure prompt before video generation
- [ ] Add "public interest content" workflow tag
- [ ] Test C2PA metadata round-trip (generate → verify)
- [ ] Document compliance posture for sales/legal review

### Week 3-7 (buffer → 2026-08-02)

- [ ] Customer-facing documentation
- [ ] Internal training for support team
- [ ] Legal review of compliance position
- [ ] Final audit before deadline

---

## Technical Implementation Details

### C2PA Metadata Standard

C2PA (Coalition for Content Provenance and Authenticity) is the industry standard for content authenticity.

**Structure**:
```json
{
  "manifest": {
    "@context": "https://c2pa.org/schemas/manifest/v1",
    "claim_generator": "Sophia AI Factory v1.0",
    "assertions": [
      {
        "label": "c2pa.ai.generated",
        "data": {
          "@context": "https://c2pa.org/schemas/ai/v1",
          "type": "text-to-image",
          "model": "anthropic/claude-opus-4-8",
          "timestamp": "2026-06-12T10:00:00Z"
        }
      }
    ],
    "signature": "..."
  }
}
```

**Embedding format**:
- JPEG/PNG: APP1 segment after SOI marker
- MP4/MOV: UUID box in moov metadata
- PDF: XMP metadata in document catalog

### Detection API

After 2026-08-02, downstream platforms (social media, news aggregators) will likely deploy detection. Sophia must ensure:

- Markers survive common transcoding (H.264, AAC, re-encode)
- Markers compatible with Adobe Content Authenticity Initiative tools
- Markers don't interfere with platform-side authenticity verification

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Missing C2PA → EU fine | HIGH (if shipped without) | €15M | Implement before deadline |
| Deepfake created via SaaS → reputation | MEDIUM | HIGH | Mandatory disclosure prompt |
| AI Act extension/amendment | LOW | LOW | Quarterly policy review |
| Customer mislabels content | MEDIUM | MEDIUM | Audit log + customer education |

---

## Sources

- **EU AI Act full text**: https://artificialintelligenceact.eu/the-act/
- **Article 50 specific**: https://artificialintelligenceact.eu/article/50/
- **C2PA standard**: https://c2pa.org/
- **Content Authenticity Initiative**: https://contentauthenticity.org/
- **European Commission AI Act explainer**: https://digital-strategy.ec.europa.eu/policies/regulatory-framework-ai

---

## Compliance Verdict

**Current status**: 🔄 Non-compliant (target compliance: 2026-08-02)

**Blocker for EU market**: Yes — cannot legally offer AI content generation to EU customers until 50(2) + 50(3) implemented.

**Critical path**: Track A.1 (C2PA watermark) is highest priority within Phase 1.

---

**Owner**: Compliance track lead
**Last reviewed**: 2026-06-12
**Next review**: Weekly until 2026-08-02, then quarterly
