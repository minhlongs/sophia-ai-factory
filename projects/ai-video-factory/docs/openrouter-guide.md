# OpenRouter Configuration for AI Video Factory

## Why OpenRouter?

**OpenRouter** = 1 API key để truy cập 300+ AI models từ 60+ providers:

| Benefit               | Impact                            |
| --------------------- | --------------------------------- |
| **Unified API**       | Không cần quản lý nhiều API keys  |
| **Cost Savings**      | Pay-per-use, không subscription   |
| **Fallback**          | Auto-failover nếu 1 provider down |
| **Model Flexibility** | Switch models dễ dàng             |
| **Response Healing**  | Auto-fix JSON defects 80%+        |

---

## Models Recommended cho AI Video Factory

### Script Generation (Quality)

| Model                         | Cost       | Speed     | Use Case        |
| ----------------------------- | ---------- | --------- | --------------- |
| `anthropic/claude-3.5-sonnet` | $0.003/1K  | Fast      | Default scripts |
| `anthropic/claude-opus-4.5`   | $0.015/1K  | Medium    | Premium content |
| `google/gemini-2.0-flash-001` | $0.0005/1K | Very Fast | Bulk generation |

### Cheap Operations (Parsing, Formatting)

| Model                                      | Cost       | Use Case               |
| ------------------------------------------ | ---------- | ---------------------- |
| `google/gemini-2.0-flash-001`              | $0.0005/1K | Metadata extraction    |
| `meta-llama/llama-3.3-70b-instruct`        | $0.0008/1K | Simple transformations |
| `mistralai/mistral-small-3.1-24b-instruct` | $0.0003/1K | Lightweight tasks      |

---

## Cost Comparison

### Before (Direct APIs)

| Service            | Monthly Cost   |
| ------------------ | -------------- |
| OpenAI (GPT-4o)    | $20/mo fixed   |
| Anthropic (Claude) | $20/mo fixed   |
| **Total**          | $40/mo minimum |

### After (OpenRouter Pay-per-use)

| Usage                          | Cost Estimate |
| ------------------------------ | ------------- |
| 30 scripts × Claude 3.5 Sonnet | ~$0.90        |
| 60 scripts × Gemini Flash      | ~$0.30        |
| 120 scripts × Mixed            | ~$1.50        |
| **Total**                      | **$1-2/mo**   |

💰 **Savings: 95%+**

---

## Setup

### 1. Get API Key

```bash
# Visit https://openrouter.ai/keys
# Create new key
# Copy to .env
OPENROUTER_API_KEY=sk-or-v1-your-key-here
```

### 2. Configure Models

```bash
# .env
OPENROUTER_SCRIPT_MODEL=anthropic/claude-3.5-sonnet
OPENROUTER_CHEAP_MODEL=google/gemini-2.0-flash-001
OPENROUTER_PREMIUM_MODEL=anthropic/claude-opus-4.5
```

### 3. API Usage

```bash
# Same as OpenAI format!
curl https://openrouter.ai/api/v1/chat/completions \
  -H "Authorization: Bearer $OPENROUTER_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "anthropic/claude-3.5-sonnet",
    "messages": [{"role": "user", "content": "Write a script"}]
  }'
```

---

## n8n Integration

### Headers Required

```json
{
  "Authorization": "Bearer {{$env.OPENROUTER_API_KEY}}",
  "HTTP-Referer": "https://your-domain.com",
  "X-Title": "AI Video Factory"
}
```

### Body Format

```json
{
  "model": "{{$env.OPENROUTER_SCRIPT_MODEL}}",
  "messages": [...],
  "temperature": 0.7,
  "max_tokens": 1000
}
```

---

## Model Routing Strategies

### By Task Type

```yaml
script_generation:
  primary: anthropic/claude-3.5-sonnet
  fallback: google/gemini-2.0-flash-001

metadata_extraction:
  primary: google/gemini-2.0-flash-001
  fallback: meta-llama/llama-3.3-70b-instruct

quality_review:
  primary: anthropic/claude-opus-4.5
  fallback: anthropic/claude-3.5-sonnet
```

### By Budget

```yaml
minimal_budget:
  default: google/gemini-2.0-flash-001

balanced:
  default: anthropic/claude-3.5-sonnet

premium:
  default: anthropic/claude-opus-4.5
```

---

## Monitoring

### Dashboard

Visit [openrouter.ai/activity](https://openrouter.ai/activity) to monitor:

- Token usage per model
- Cost breakdown
- Request logs
- Error rates

### Budget Limits

```bash
# Set monthly budget limit in OpenRouter dashboard
# Get alerts when approaching limit
```

---

## Resources

- [OpenRouter Docs](https://openrouter.ai/docs)
- [Model Rankings](https://openrouter.ai/rankings)
- [Pricing](https://openrouter.ai/models)
- [API Reference](https://openrouter.ai/docs/api-reference)
