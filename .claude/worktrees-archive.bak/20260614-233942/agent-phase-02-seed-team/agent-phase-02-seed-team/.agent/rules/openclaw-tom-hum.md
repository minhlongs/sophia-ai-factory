# 🦞 TÔM HÙM (OpenClaw) - Global Rules

> **MANDATORY** - All agents must follow

---

## Usage Split

| User                | LLM Provider      | Config      |
| ------------------- | ----------------- | ----------- |
| **Anh (Admin)**     | Antigravity Proxy | Local proxy |
| **Sophia (Client)** | OpenRouter        | API key     |

---

## File Format

```
skills/{name}/SKILL.md
HEARTBEAT.md
openclaw.json
```

---

## Sophia's OpenClaw Config

```json
{
  "providers": {
    "openrouter": {
      "apiKey": "sk-or-xxx",
      "model": "anthropic/claude-sonnet-4-20250514"
    }
  }
}
```

```bash
export OPENROUTER_API_KEY="sk-or-xxx"
```

---

## Anh's Setup (Triple Agent)

```
Gemini ←→ Antigravity Proxy ←→ CC CLI
              ↓
         OpenClaw (local dev)
```

---

_v1.2 | 2026-02-04 | Sophia=OpenRouter, Anh=Antigravity_
