# Video Generation Pipeline Research — Executive Summary
**For:** Planner Agent | **From:** Researcher | **Date:** 2026-04-29

## Key Finding
**Compose 5-layer pipeline from OSS: Remotion (render) + HunyuanVideo 1.5 (T2V) + Coqui XTTS (audio) + MoviePy (fallback) + MoneyPrinterTurbo (reference)**

Cost: $5.50-16.55/cinematic video OR $0.35-1.00/template-based video.

---

## DISTILLED STACK

| Layer | Tool | License | Cost | Notes |
|-------|------|---------|------|-------|
| **Script** | Qwen 3 32B local | Free | $0 | Already have (Ollama) |
| **Audio** | Coqui TTS Docker | MPL-2.0 ✅ | $0 | Voice cloning (XTTS), self-hosted |
| **Video Gen** | HunyuanVideo 1.5 | Apache 2.0 ✅ | $5-15 | 720P, GPU rental (Runpod) |
| **Compose** | Remotion TS | Proprietary ⚠️ | $0.20-0.50 | Fast, serverless, verify license |
| **Fallback** | MoviePy Python | MIT ✅ | $0.10-0.50 | Slower, reliable |

---

## ARCHITECTURE (Planner Input)

```
Cloudflare Workers (orchestrator)
  ├─ Script Gen: localhost:11434 (Qwen local)
  ├─ Audio: Docker microservice Coqui (localhost:8000)
  ├─ T2V: GPU runner (HunyuanVideo 1.5 on Runpod/Lambda)
  ├─ Render: Remotion serverless (TS/Next.js native)
  └─ Storage: Supabase bucket + CDN
```

---

## NEXT STEPS FOR PLANNER

1. **Verify Remotion commercial license** (blocking decision)
2. **Design Supabase schema** for video job state (script, audio, video, render status)
3. **Create Runpod/Lambda deployment script** for HunyuanVideo 1.5
4. **Build Cloudflare Worker orchestrator** (state machine: queued → generating → rendering → published)
5. **Setup Coqui Docker microservice** locally (already have Docker)
6. **Create Remotion template** for affiliate landing page video (brand colors, text overlays)

---

## FULL REPORT
👉 See: `researcher-260429-2050-video-gen-oss.md` (400 lines, all details)

---

## UNRESOLVED (FLAG FOR PLANNER)
- ⚠️ Remotion commercial license clarity
- ⚠️ HunyuanVideo 100M MAU cap interpretation (when does it apply?)
- ⚠️ Coqui XTTS cloning quality at scale (need validation test)
