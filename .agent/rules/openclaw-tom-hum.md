# 🦞 TÔM HÙM (OpenClaw) - Global Rules

> **MANDATORY** - All agents (Gemini, CC CLI, OpenClaw) must follow
> **VERIFIED:** OpenClaw supports Antigravity Proxy ✅

---

## File Format Standards

### ✅ CORRECT Format

```
skills/
├── affiliate-scout/
│   └── SKILL.md
├── content-producer/
│   └── SKILL.md
└── auto-publisher/
    └── SKILL.md

HEARTBEAT.md
openclaw.json
```

### SKILL.md Template

```markdown
---
name: skill-name
description: "What this skill does"
metadata:
  openclaw:
    emoji: 🔍
---

# Skill Instructions...
```

---

## ✅ Antigravity Proxy Integration (VERIFIED)

### Method 1: Environment Variables

```bash
export ANTHROPIC_API_KEY="proxy-key"
export ANTHROPIC_BASE_URL="http://localhost:PORT/v1"
```

### Method 2: openclaw.json

```json
{
  "providers": {
    "anthropic": {
      "apiKey": "proxy-key",
      "baseUrl": "http://localhost:PORT/v1"
    }
  }
}
```

### Method 3: UI Config

`Config → Models → Providers → Add → Base URL`

---

## Triple Agent Collaboration

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  Gemini     │ ←── │ Antigravity │ ──→ │  OpenClaw   │
│ (Antigrav)  │     │   Proxy     │     │  (TÔM HÙM)  │
└─────────────┘     └─────────────┘     └─────────────┘
       ↕                   ↓                   ↕
       └───────────────────┬───────────────────┘
                           ↓
                    ┌─────────────┐
                    │   CC CLI    │
                    └─────────────┘
```

---

## Go-Live Checklist

1. [ ] CC CLI completes sophia-ai-factory
2. [ ] Build GREEN ✅
3. [ ] Deploy to Vercel
4. [ ] Setup OpenClaw on VPS
5. [ ] Configure Antigravity Proxy
6. [ ] Test Triple Agent System

---

_v1.1 | 2026-02-04 | Antigravity Integration: VERIFIED_
