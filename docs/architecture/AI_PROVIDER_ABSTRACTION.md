# AI Provider Abstraction / Trừu tượng hóa Nhà cung cấp AI

> Canonical reference for extending the provider interface in `seed/ai/`.
> Rule: **EXTEND, never replace.**

---

## EN / Tiếng Anh

### Design Principles / Nguyên tắc thiết kế

1. **Extend existing interface.** All new provider adapters implement `Provider` from `seed/ai/provider-interface.ts`. Never create a parallel interface.
2. **Capability-based routing.** Requests declare what they need (TEXT, VISION, IMAGE, VIDEO, AUDIO, TTS, STT, EMBEDDING, REASONING, CODE). The router matches capabilities to available providers.
3. **Constraints-first.** Every request carries optional `quality`, `cost`, `latency` constraints. The router optimizes within constraints.
4. **BYOK and platform keys coexist.** Customers bring their own keys (Setup Wizard). Platform provides fallback keys. Local providers (self-hosted) are first-class.

### Capability Types / Loại khả năng

| Capability | Description | Example providers |
|---|---|---|
| TEXT | Chat and completion | OpenRouter, Anthropic |
| VISION | Image understanding | GPT-4o, Claude |
| IMAGE | Image generation | DALL-E, Stable Diffusion |
| VIDEO | Video generation | WAN, HeyGen, D-ID |
| AUDIO | Audio processing | OpenAI Whisper |
| TTS | Text-to-speech | ElevenLabs, Fish Speech |
| STT | Speech-to-text | OpenAI Whisper, Deepgram |
| EMBEDDING | Vector embeddings | OpenAI Embeddings |
| REASONING | Chain-of-thought tasks | Claude, o3 |
| CODE | Code generation | Claude, GPT-4o |

### Provider Interface / Giao diện Provider

Source: `seed/ai/provider-interface.ts`

```typescript
// Canonical provider identifiers
type ProviderId = 'openrouter' | 'anthropic' | 'elevenlabs' | 'wan' | 'fish-speech';

// Every adapter must implement:
interface Provider {
  getId(): ProviderId;
  getCapabilities(modelId: string): ProviderCapabilities;
  chat(messages: ChatMessage[], options: ChatOptions): Promise<ChatResponse>;
  chatStream(messages: ChatMessage[], options: ChatOptions): AsyncIterable<StreamChunk>;
}
```

Key types:
- `ChatMessage` — role (`system` | `user` | `assistant` | `tool`) + content
- `ChatResponse` — content, model, provider, usage (inputTokens/outputTokens), stopReason, latencyMs
- `StreamChunk` — text_delta or anthropic_event with done flag
- `ProviderCapabilities` — streaming, systemRole, maxOutputTokens, maxInputTokens, functionCalling, vision

### Request Flow / Luồng yêu cầu

```
Application code
  → MultiProviderRouter.route(request)
    → classifyComplexity(simple | medium | complex)
    → selectRoute(complexity, constraints)
    → ProviderRegistry.getHealthy(preferred)
      → check health via ProviderHealthTracker
      → fallback chain if primary unhealthy
    → Provider.chat() or .chatStream()
    → CostEstimator.estimateCost(provider, messages, response)
    → RoutedChatResult { response, providerId, complexity, usedFallback, estimatedCost, attempts }
```

### Provider Registry / Registry Nhà cung cấp

Source: `seed/ai/provider-registry.ts`

The registry is an in-memory `Map<ProviderId, RegistryEntry>`. Each entry holds:
- The `Provider` instance
- A `ProviderHealthTracker` for latency and failure tracking
- A `Map<string, Capabilities>` keyed by model ID

```typescript
const registry = new ProviderRegistry();
registry.register(openRouterProvider);
const healthy = registry.getHealthy();
const fallback = registry.getFallbackChain('openrouter', 'anthropic');
```

### Provider Health / Sức khỏe Provider

Source: `seed/ai/provider-health.ts`

Tracks per-provider: `healthy`, `inCooldown`, `avgLatencyMs`, `consecutiveFailures`, `totalRequests/Successes/Failures`. Health state drives fallback decisions in the registry.

### Cost Estimation / Ước tính chi phí

Source: `seed/ai/cost-estimator.ts`

Static pricing table per provider/model:
- Text models: USD per 1K tokens (input + output)
- TTS providers: USD per character
- Video generation: USD per second

```typescript
import { estimateCost } from '@/seed/ai/cost-estimator';
const cost = estimateCost('openrouter', 'claude-sonnet-4-6', inputTokens, outputTokens);
```

### Multi-Provider Router / Bộ định tuyến đa nhà cung cấp

Source: `seed/ai/multi-provider-router.ts`

Flow: classify prompt complexity, select primary provider, try with retryable-error handling, walk fallback chain on failure. Returns `RoutedChatResult` with `usedFallback` flag for observability.

### Adding a New Provider / Thêm nhà cung cấp mới

1. Create adapter file: `seed/ai/{name}-adapter.ts`
2. Implement `Provider` interface from `provider-interface.ts`
3. Define `ProviderCapabilities` for each supported model
4. Register in `ProviderRegistry`
5. Add pricing to `cost-estimator.ts`
6. Update `ProviderId` type in `provider-interface.ts`

### Support Types / Loại hỗ trợ

| Support type | Description |
|---|---|
| BYOK | Customer-provided API keys via Setup Wizard |
| Platform keys | Operator-managed fallback keys (optional) |
| Local providers | Self-hosted models (OClaude-Fable, vLLM) |
| OpenAI-compatible | Any API conforming to OpenAI chat format |
| OpenRouter-like | Gateway aggregators with unified API |

---

## VN / Tiếng Việt

### Nguyên tắc thiết kế

1. **Mở rộng interface hiện tại.** Tất cả adapter mới implement `Provider` từ `seed/ai/provider-interface.ts`. Không bao giờ tạo interface song song.
2. **Định tuyến theo khả năng.** Yêu cầu khai báo nhu cầu (TEXT, VISION, IMAGE, VIDEO, AUDIO, TTS, STT, EMBEDDING, REASONING, CODE). Router ghép với nhà cung cấp khả dụng.
3. **Constraint trước.** Mỗi yêu cầu mang `quality`, `cost`, `latency` tuỳ chọn. Router tối ưu trong ràng buộc.
4. **BYOK và platform key cùng tồn tại.** Khách tự nhập key (Setup Wizard). Platform cung cấp key dự phòng.

### Luồng định tuyến

```
Application
  → MultiProviderRouter.route()
    → Phân loại độ phức tạp
    → Chọn route phù hợp
    → Registry kiểm tra sức khỏe
    → Provider.chat() / .chatStream()
    → Ước tính chi phí
    → Trả kết quả + fallback info
```

### Thêm nhà cung cấp mới

1. Tạo adapter: `seed/ai/{name}-adapter.ts`
2. Implement `Provider` từ `provider-interface.ts`
3. Định nghĩa `ProviderCapabilities`
4. Đăng ký vào `ProviderRegistry`
5. Thêm giá vào `cost-estimator.ts`
6. Cập nhật `ProviderId` trong `provider-interface.ts`

---

*Sources: `seed/ai/provider-interface.ts`, `provider-registry.ts`, `multi-provider-router.ts`, `cost-estimator.ts`*