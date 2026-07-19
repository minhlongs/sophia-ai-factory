# AI Video Landscape Research — Immediate Actions for Sophia

**Research Date:** May 22, 2026  
**Status:** Ready for implementation  
**Owner:** Sophia AI Factory product team

---

## TL;DR

Sophia's video factory SaaS should orchestrate **3 providers + 1 voice engine**:

| Component | Provider | Cost | Why |
|-----------|----------|------|-----|
| **Text-to-Video** | Kling 3.0 | $0.06–0.12/sec (aggregator) | Best price-quality; APAC support |
| **Avatar** | HeyGen Avatar IV | $1/min 1080p | Most reliable; 500+ creator ecosystem |
| **Voice** | ElevenLabs | Usage-based | Only Vietnamese TTS confirmed (May 2026) |
| **Orchestration** | Inngest + Workers | Existing stack | Serverless job queue; no GPU needed on Workers |

---

## Week 1 Implementation Checklist

### Day 1–2: Kling 3.0 API Integration
- [ ] Sign up to Crazyrouter.io (Kling aggregator, 30% cheaper)
- [ ] Copy API key to `.env.local` as `KLING_API_KEY`
- [ ] Test endpoint: `POST https://api.crazyrouter.com/v1/kling/generate`
- [ ] Create `/api/video/kling` endpoint in Sophia (async, returns job ID)
- [ ] Store job status in D1: `(userId, jobId, provider, createdAt, status, videoUrl)`

### Day 3: HeyGen Avatar API
- [ ] Sign up HeyGen.com; purchase API credits
- [ ] Copy API key to `.env.local` as `HEYGEN_API_KEY`
- [ ] Test avatar generation: text + avatar_id → job ID
- [ ] Create `/api/avatar/heygen` endpoint
- [ ] Test lip-sync with HeyGen's native engine (no additional config needed)

### Day 4: ElevenLabs Voice Integration
- [ ] Sign up ElevenLabs.io; verify Vietnamese TTS available
- [ ] Copy API key + Voice IDs to `.env.local`
- [ ] Create voice clone for test user (Vietnamese sample: 30 seconds of speech)
- [ ] Create `/api/voice/elevenlabs` endpoint: `text + voiceId → MP3 URL`
- [ ] Test: Vietnamese TTS → verify MP3 is intelligible

### Day 5: End-to-End Flow
- [ ] User enters: "Create video about Vietnamese coffee"
- [ ] Flow: Kling T2V (10s) → HeyGen avatar (2s) → ElevenLabs Vietnamese voiceover → combine via FFmpeg
- [ ] Store final MP4 in Cloudflare R2
- [ ] Return shareable CDN URL to user

---

## Critical Vietnamese Language Validation

**Before shipping PREMIUM tier, MUST verify:**

```bash
# Test 1: ElevenLabs Vietnamese TTS
curl -X POST https://api.elevenlabs.io/v1/text-to-speech/{VOICE_ID} \
  -H "xi-api-key: ${ELEVEN_API_KEY}" \
  -d '{"text":"Xin chào, đây là âm thanh tiếng Việt","voice_settings":{"stability":0.5}}'
# Expected: HTTP 200 + MP3 bytes

# Test 2: HeyGen avatar + Vietnamese voice lip-sync
# Create HeyGen avatar with ElevenLabs Vietnamese voiceover
# Verify lip movements match Vietnamese phonemes (not English)
```

**If lip-sync fails:** Use Synthesia Creator tier ($89/mo) instead; creator plans include Vietnamese lip-sync.

---

## 30-Day Roadmap

### Week 1: Core Integration (above)
- Single T2V (Kling) + Avatar (HeyGen) + Voice (ElevenLabs)
- Store jobs in D1; track tier usage (BASIC limit: 10 videos/mo)
- Manual webhook polling (Inngest not needed yet)

### Week 2: Tier Enforcement + Payment
- Add tier checks: BASIC users get Kling + basic avatars; PREMIUM get Sora 2 fallback
- Wire up NOWPayments IPN to tier activation
- Test BASIC tier customer end-to-end

### Week 3: Sora 2 Fallback (Optional, if PREMIUM tier ready)
- Add Sora 2 via OpenRouter (aggregator, no direct OpenAI setup)
- Implement fallback logic: if Kling fails → retry → try Sora 2
- Add Inngest for reliable job queue (vs manual polling)

### Week 4: Telegram Bot Integration
- Add `/video` command to Sophia_Bbot
- Allow users to submit video requests via Telegram
- Send results back to Telegram chat

---

## Cost Projections (Monthly, 100 active users)

### BASIC Tier (avg 2 videos/user/month = 200 videos)
- Kling: 200 videos × 10s × $0.09/sec = **$180**
- HeyGen: 100 avatars × $1/min = **$100**
- ElevenLabs: ~10M characters = **$150**
- **Subtotal: $430/month**
- **BASIC retail: $29 × 50 users = $1,450/month** ✓ Profitable

### PREMIUM Tier (avg 5 videos/user/month = 100 videos)
- Sora 2 (60%) + Kling (40%): 60 × $0.30/sec + 40 × $0.09/sec = **$300**
- HeyGen: 50 avatars × $1/min = **$50**
- ElevenLabs: **$100**
- **Subtotal: $450/month**
- **PREMIUM retail: $99 × 30 users = $2,970/month** ✓ Profitable

---

## Risk Mitigation

### Risk: Kling API rate limits
**Mitigation:** Add Runway Gen-3 as secondary T2V (cheaper than Sora, faster than Kling)

### Risk: HeyGen avatar pricing spikes
**Mitigation:** Keep Synthesia Creator ($89/mo) contract ready; switch if HeyGen >$1.50/min

### Risk: ElevenLabs Vietnamese TTS fails on real users
**Mitigation:** 
- Verify in BETA with 10 Vietnamese creators before public launch
- Document fallback: "Use English avatar + English voice if Vietnamese unavailable"
- Have Google Cloud TTS (Vietnamese support) as backup

### Risk: Seedance 2.0 API opens mid-2026
**Mitigation:** Don't block launch; integrate as "EXPERIMENTAL" provider later. Current stack sufficient.

---

## Success Metrics (30-Day Target)

- [ ] 50 BASIC tier signups
- [ ] 10 PREMIUM tier signups
- [ ] <5 min average latency (Kling + HeyGen + ElevenLabs combined)
- [ ] <5% API error rate (failures → user retry)
- [ ] 100% Vietnamese TTS intelligibility (user feedback)
- [ ] $2,000 MRR revenue (profitable unit economics)

---

## Known Limitations (Document in Terms of Service)

1. **Prompts must be in English** — No Vietnamese prompts supported yet; workaround = English brief + Vietnamese voiceover
2. **Avatar inventory:** HeyGen 500+ avatars; Vietnamese-ethnicity avatars limited (request custom if needed)
3. **Video length:** Max 10s per generation (can chain multiple)
4. **No real-time avatars:** Tavus CVI reserved for MASTER tier (future, TBD)

---

## Escalations / Decisions Needed

1. **Synthesia vs HeyGen for Vietnamese lip-sync:** Need lab test result before PREMIUM launch
2. **Seedance 2.0:** Monitor copyright litigation; prepare contingency if API opens before MASTER tier launch
3. **Inngest scheduling:** Is manual polling sufficient for Week 1, or integrate Inngest immediately? (Recommend defer to Week 3)
4. **Custom avatar creation:** Should MASTER tier include 1 custom avatar per user? (Cost ~$1k per, long turnaround)

---

## Open Questions

1. Can HeyGen's lip-sync handle Vietnamese phonemes from non-Vietnamese avatars? (Lab test needed)
2. Does Synthesia really support Vietnamese? (Trial needed)
3. What's the Kling queue depth at peak hours? (Could cause user wait >5 min)
4. Can we offer volume discounts to enterprise customers using our platform?

---

**Report:** Full analysis at `/Users/macbook/projects/sophia-ai-factory/plans/reports/research-05-ai-video-gen-landscape-2026.md`

**Next Sync:** May 29, 2026 (Day 7 progress checkpoint)
