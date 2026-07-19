# Phase 08 — Visual Generator (Template + Cinematic 2-path)

## Status: ✅ DONE 2026-04-30

## Goal
2-path routing: TEMPLATE (Remotion/MoviePy, $0.35-1.00) vs CINEMATIC (HunyuanVideo on Runpod, $5.50-16.55).

## Decision (auto-mode default)
- Template path: **MoviePy clean-room** (avoid Remotion $500/mo)
- Cinematic path: **HunyuanVideo 1.5 on Runpod**

## Deliverables
- [ ] Path router: cost-tier driven (free/basic = template, premium+ = cinematic)
- [ ] `services/moviepy-render/` Docker
- [ ] `services/hunyuan-runner/` Runpod template
- [ ] Cost estimator pre-render
- [ ] Quality preview thumbnails

## Files
- `apps/sophia-ai-factory/lib/video/router.ts`
- `services/moviepy-render/`
- `services/hunyuan-runner/`

## Risk: Medium — Runpod cold-start latency, quality SLA

## Effort: 5-7 days
