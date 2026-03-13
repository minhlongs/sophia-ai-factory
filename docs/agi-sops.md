# AGI Standard Operating Procedures (SOPs)

**Version:** 1.0
**Last Updated:** 2026-03-11
**Platform:** Sophia AI Factory + Ollama

---

## 1. Overview

SOPs cho việc vận hành AGI/LLM local với Ollama trong Sophia AI Factory.

---

## 2. Quick Start

```bash
# 1. Start Ollama
ollama serve

# 2. Pull model
ollama pull llama3.2:3b

# 3. Test
ollama run llama3.2:3b "Hello"

# 4. Use Sophia Chat
pnpm dev
# Open http://localhost:3000
```

---

## 3. Model Selection Guide

| Use Case | Model | RAM | Speed | Quality |
|----------|-------|-----|-------|---------|
| Simple Q&A | llama3.2:1b | 2GB | Fast | Good |
| General Chat | llama3.2:3b | 4GB | Medium | Better |
| Code Gen | codellama:7b | 8GB | Slow | Best |
| Creative | mistral:7b | 8GB | Slow | Best |

---

## 4. Prompt Templates

### Standard Format

```markdown
### Context
[Bối cảnh/môi trường]

### Task
[Nhiệm vụ cụ thể]

### Constraints
[Ràng buộc/giới hạn]

### Output Format
[Định dạng đầu ra mong muốn]
```

### Examples

**Code Review:**
```
### Context
Review this TypeScript React component

### Task
Find bugs and suggest improvements

### Constraints
- Focus on type safety
- Check for React best practices

### Output Format
- List issues by severity
- Provide fixed code
```

**Content Generation:**
```
### Context
Writing marketing copy for AI product

### Task
Generate 3 headline options

### Constraints
- Under 10 words each
- Include benefit

### Output Format
Numbered list with headlines
```

---

## 5. Quality Gates

### Before Accepting Output

- [ ] Output matches requested format
- [ ] No hallucinations (verify facts)
- [ ] Code syntax valid (run linter)
- [ ] Length within limits
- [ ] Tone matches context

### Validation Checklist

| Check | Method |
|-------|--------|
| Syntax | Run compiler/linter |
| Facts | Cross-reference sources |
| Logic | Manual review |
| Safety | No PII/secrets exposed |

---

## 6. Error Recovery

| Error | Cause | Solution |
|-------|-------|----------|
| Timeout | Response too long | Reduce maxTokens, split prompt |
| OOM | Model too large | Use smaller model (1b vs 3b) |
| Garbage output | Temperature too high | Set temperature=0.3 |
| Loop/repeat | Bad prompt structure | Add "Don't repeat" constraint |
| Ollama not responding | Service stopped | `ollama serve` |

### Recovery Commands

```bash
# Restart Ollama
brew services restart ollama

# Free memory
ollama stop llama3.2:3b

# Check status
ollama list
ollama ps
```

---

## 7. Performance Tips

### Optimization

| Technique | Impact |
|-----------|--------|
| Use smaller models | 2-3x faster |
| Set maxTokens low | Faster response |
| Cache common prompts | Instant response |
| Batch related questions | Fewer round trips |

### Caching Strategy

```typescript
const cache = new Map<string, string>()

async function generateWithCache(prompt: string) {
  if (cache.has(prompt)) return cache.get(prompt)
  const response = await generate(prompt)
  cache.set(prompt, response)
  return response
}
```

---

## 8. Security Guidelines

### DO

- Run on localhost only
- Validate all inputs
- Sanitize outputs for XSS
- Rate limit requests

### DON'T

- Expose Ollama to public network
- Send PII/sensitive data
- Log full prompts/responses
- Trust output blindly

---

## 9. Monitoring

### Metrics to Track

| Metric | Target | Alert If |
|--------|--------|----------|
| Response time | < 3s | > 10s |
| Error rate | < 1% | > 5% |
| RAM usage | < 8GB | > 12GB |
| Queue depth | < 5 | > 20 |

---

## 10. Troubleshooting FAQ

**Q: Ollama slow to respond?**
A: Use smaller model, reduce maxTokens, check RAM.

**Q: Output quality poor?**
A: Try different model, improve prompt, lower temperature.

**Q: Out of memory?**
A: Stop current model, use smaller one, close other apps.

**Q: API returns 500?**
A: Check Ollama running: `curl http://localhost:11434/api/tags`

---

## Related Docs

- [Local LLM Setup Guide](./local-llm-setup.md)
- [LLM API Reference](./llm-api.md)
