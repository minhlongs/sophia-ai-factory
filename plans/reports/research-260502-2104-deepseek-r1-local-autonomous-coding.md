# Research: DeepSeek R1 Local trên M1 Max 64GB cho OpenClaw Autonomous Coding

**Conducted:** 2026-05-02 21:05 PT
**Sources:** 5 Gemini search calls (model: gemini-3-flash-preview)
**Scope:** Feasibility autonomous Sophia development bằng DeepSeek R1 distilled local, KHÔNG dùng Claude cloud
**Hardware target:** Apple M1 Max 64GB unified memory

## Executive Summary

**100% local autonomous = KHÔNG khả thi cho zero-bug Sophia go-live.** R1-Distill-32B đạt 41.6% SWE-bench Verified vs Claude Opus 4.7 80.8% → quality drop 50%. Tool-calling fail rate ~10% vs Claude 2% — tạo regression nhiều hơn fix.

**Khả thi cho Sophia:** (1) **Plan/Act hybrid** (R1 planner + Claude actor) ~70% cost saving, ~5-10% quality drop; (2) **R1 as Sophia mission consumer** — wire vào `proposal:create`, `email:campaign` handlers, customer choose local hoặc cloud trong setup-wizard. Đó mới là sweet spot.

## Key Findings

### 1. Performance trên M1 Max 64GB (Q4_K_M MLX)

| Model | Tok/s MLX | Tok/s Ollama | VRAM |
|-------|-----------|--------------|------|
| R1-Distill-Qwen-32B | **18-22 t/s** | 12-15 | ~19.2 GB |
| R1-Distill-Llama-70B | 6-9 t/s | 4-6 | ~41.5 GB |

- 32B = "Goldilocks" cho M1 Max (16-32GB free cho OS + dev tools)
- 70B = tight, slow, không cho concurrent dev work
- Ollama v0.19+ giờ dùng MLX backend mặc định trên Mac → gần bằng MLX-LM raw
- oMLX server mới có **SSD-cached KV** giảm TTFT 60s→<5s cho long context agentic sessions

### 2. SWE-bench Verified 2025-2026 (autonomous coding)

| Model | Score | Type |
|-------|-------|------|
| **Claude Opus 4.7** | **80.8%** | Cloud (current — Sophia using) |
| Claude Sonnet 4.5 | 77.2% | Cloud |
| Qwen 3 Coder 32B | 69.6% | Open-weight (best local) |
| DeepSeek V3.1-Think | 66.0% | Cloud (R1 successor) |
| DeepSeek R1 671B | 49.2% | Cloud (full) |
| R1-Distill-Llama-70B | 48.9% | Local (slow) |
| **R1-Distill-Qwen-32B** | **41.6%** | **Local (M1 Max sweet spot)** |

**Verdict:** R1-Distill-32B = ~52% Claude Opus quality. Cho complex refactor (BYOK, race conditions, CF Workers), drop quality không chấp nhận được. **Qwen 3 Coder 32B** là local choice tốt hơn (69.6%) — nên xem xét thay thế R1 distill.

### 3. Tool Calling — Failure Mode chính

**R1 distill 3 failure modes phổ biến:**
1. **Simulated execution hallucination:** Model "thinks" it called tool, writes summary của file mà KHÔNG emit JSON tool call thật → silent fail
2. **Format drift:** Aider Search/Replace fail vì model reason đúng nhưng output không match format strict
3. **Reasoning drain:** 128K context bị eat 10-20K bởi `<think>` block trước khi viết code

**Tool calling success rate (BFCL benchmark):**
- Claude Sonnet 4.5: ~89.5% (gold standard)
- DeepSeek R1: ~86.2% (May 2025 improvement)
- R1-Distill: ~75-80% (worst)

**Workarounds 2025:**
- **XML format > JSON** cho R1 (clear delimiters)
- Strict mode JSON: chỉ DeepSeek API v3.2+ supports, R1-0528 checkpoint
- Move tool defs từ system → first user message (R1 official rec)
- Regex-strip `<think>` block client-side trước khi parse
- Temperature 0.6 (R1 official sweet spot)

### 4. LiteLLM Hybrid Routing — khả thi với Claude Code CLI

**ANTHROPIC_BASE_URL override mechanism**:
```bash
export ANTHROPIC_BASE_URL="http://localhost:4000"  # LiteLLM proxy
export ANTHROPIC_API_KEY="sk-local-proxy-key"      # dummy
claude
```

LiteLLM v1.63+ tự động map R1's `<think>` blocks → Anthropic `thinking` content blocks. Ollama backend vẫn dùng được, hoặc oMLX cho speed.

**Complexity router config:**
```yaml
router_settings:
  routing_strategy: cost-based-routing
  enable_complexity_router: true
  complexity_threshold: 0.4  # < 0.4 → local, else cloud
  fallbacks: [{"claude-3-5-sonnet-20241022": ["cloud-fallback"]}]
```

**DeepSeek API also offers Anthropic-compat endpoint:**
```bash
export ANTHROPIC_BASE_URL=https://api.deepseek.com/anthropic
export ANTHROPIC_AUTH_TOKEN=<deepseek-key>
export ANTHROPIC_DEFAULT_SONNET_MODEL=deepseek-reasoner
```

### 5. "DeepClaude" Plan/Act Pattern — 2025 Meta

**Real-world consensus** từ Reddit/HN/Twitter testimonials:
| Task | Winner |
|------|--------|
| Logic / debugging algorithms | R1 (planner) |
| Frontend / CSS / UI | Claude Sonnet (actor) |
| Tool calling / file ops | Claude (actor) |
| Cost (10x cheaper R1) | R1 |
| Multi-file refactor 50+ files | Claude (1M context) |

**Quote từ user:** "R1 found bugs Sonnet missed for 3 days. But R1 is text-blind for CSS."

## Architecture Recommendation cho Sophia

### KHÔNG nên (refused)
- Pure local R1 driving Sophia critical work — quality drop 50% sẽ tạo regression. Sophia có 2300+ tests, từng plan cần Claude-level care.

### NÊN — 2 paths

#### Path A: Plan/Act Hybrid (cho future side projects)
- **R1-Distill-32B (local) = Planner**: phân tích yêu cầu, generate plan.md, debug logic
- **Claude Opus 4.7 (cloud) = Actor**: thực thi file edits, tool calls, deploy
- Setup: LiteLLM router với complexity classifier
- Saving: ~70% Claude tokens
- KHÔNG cho Sophia critical work hiện tại

#### Path B: R1 as Sophia Consumer (HIGHLY recommended)
Wire R1 vào Sophia mission handlers thực tế:
- `proposal:create` — gọi R1 với template, return markdown proposal
- `email:campaign` — generate copy
- `analytics:report` — summarize stats
- `subtitle:generate` — text refinement

**Setup-wizard option:** customer chọn:
1. Sophia LLM (cloud, default) — pay-per-MCU
2. **BYO Local LLM** — point Sophia tới `http://customer-mac.local:11434/v1` (Ollama OpenAI-compatible)
3. BYO API key (OpenRouter/Anthropic/DeepSeek)

**Strategic value:** "Sophia is BYOK including BYO-LLM" → unique selling point. Privacy-conscious customers + tech agencies có M2/M3 Max → free inference. Existing competitors (HeyGen, Synthesia) không offer này.

## Implementation Recommendations

### Path B Quick Start (~2-3h cook)

1. New env var pattern: customer's `LOCAL_LLM_URL` stored encrypted trong `user_provider_credentials` (provider='local_llm')
2. Setup wizard step "Local LLM (optional)" → URL input + test ping `/v1/models`
3. Mission handler refactor:
   ```ts
   const llmUrl = await getUserCredential(userId, 'local_llm') 
                ?? await getUserCredential(userId, 'openrouter') 
                ?? process.env.OPENROUTER_API_KEY  // platform fallback
   ```
4. Documentation page `/dashboard/help/byo-local-llm` với guide:
   - "Install Ollama: `brew install ollama`"
   - "Run model: `ollama run deepseek-r1:32b`"
   - "Expose: `ollama serve` exposes :11434 by default"
   - "Sophia URL: `http://localhost:11434/v1`"
   - "Or expose securely via Cloudflare Tunnel"

### Path A Setup (deferred until Sophia stable)

```bash
# 1. Install LiteLLM
pip install 'litellm[proxy]'

# 2. config.yaml
cat > litellm-config.yaml <<EOF
model_list:
  - model_name: claude-opus-4-7
    litellm_params:
      model: ollama/deepseek-r1:32b
      api_base: http://localhost:11434
      
  - model_name: claude-opus-4-7-cloud
    litellm_params:
      model: anthropic/claude-opus-4-7
      api_key: os.environ/ANTHROPIC_API_KEY

router_settings:
  routing_strategy: cost-based-routing
  enable_complexity_router: true
  complexity_threshold: 0.4
  fallbacks: [{"claude-opus-4-7": ["claude-opus-4-7-cloud"]}]
EOF

# 3. Run
litellm --config litellm-config.yaml --port 4000

# 4. Override Claude Code
export ANTHROPIC_BASE_URL=http://localhost:4000
claude --dangerously-skip-permissions
```

## Common Pitfalls

| Pitfall | Mitigation |
|---------|-----------|
| R1 "thinking" loops never emit tool call | Use XML format + regex-first parsing |
| Reasoning drain → context overflow | Manually clear `<think>` history each turn |
| Ollama default 4K context | `Modelfile`: `PARAMETER num_ctx 32768` |
| LiteLLM strips `reasoning_content` | Use v1.63+ for native R1 mapping |
| Cold start 30-60s | oMLX SSD KV cache → <5s |
| Tool format mismatch (XML/JSON) | Strict mode chỉ trên DeepSeek v3.2+ API |

## Resources & References

### Official Documentation
- DeepSeek R1 paper: arxiv.org/abs/2501.12948
- LiteLLM docs: docs.litellm.ai
- Ollama Apple Silicon guide: ollama.com/blog/macos
- MLX-LM: github.com/ml-explore/mlx-examples
- SWE-bench Verified leaderboard: swebench.com/verified

### Recommended Tools
- **Ollama v0.19+** — easiest, GBNF grammar enforcement for valid JSON
- **oMLX** — SSD KV cache for long agentic sessions
- **llama.cpp** — production throughput, IQ4_XS quant for 70B on 64GB
- **LiteLLM** — Anthropic-compat proxy
- **Aider** + DeepSeek API — battle-tested R1 coding workflow

### Community
- r/LocalLLaMA — Apple Silicon benchmarks
- DeepSeek Discord — official support
- LiteLLM Discord — routing config help

## Next Actions cho Sophia

**Recommend cook Path B (R1 as Sophia consumer):**
1. Add `local_llm` provider support trong `user_provider_credentials`
2. Setup wizard step + test ping
3. Mission handler refactor để chọn local-first
4. Marketing landing: "BYO Local LLM — Free inference on your M2 Max"
5. Doc page `/dashboard/help/byo-local-llm`

**KHÔNG recommend Path A cho Sophia hiện tại:**
- 50% quality drop sẽ break Sophia tests
- Tool calling fail rate 10%+ tạo regression
- Defer đến khi Sophia có 50+ paying customers + lower-stakes side projects

## Unresolved Questions

1. **Sophia mission handler latency budget**: customer M1 Mac chạy R1-32B = 18 t/s, generating 500-token proposal mất ~28s. Acceptable cho `proposal:create` async mission, NOT cho realtime chat. Customer expectation?
2. **Customer infrastructure literacy**: setup Ollama + expose securely qua Cloudflare Tunnel cần skill — đa số agency Vietnam liệu có làm được? Có cần Sophia provide one-click installer?
3. **Quality vs latency tradeoff per command**: `proposal:create` chấp nhận 30s với R1, nhưng `email:test` cần <2s — khác model per task?
4. **Cloud R1 fallback?**: DeepSeek API (cloud) chạy R1 671B at $0.55/M tokens — vẫn rẻ hơn Claude. Worth offer như tier giữa local và Claude?
5. **Output format strategy**: XML hay JSON cho structured output từ R1 trong Sophia? Ảnh hưởng đến `mission.result` schema.
