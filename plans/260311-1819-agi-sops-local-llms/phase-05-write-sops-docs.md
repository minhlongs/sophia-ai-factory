# Phase 5: Write SOPs Documentation

**Date:** 2026-03-11
**Priority:** LOW
**Status:** PLANNED

---

## Context

- Parent Plan: [plan.md](./plan.md)
- Dependencies: Phase 1-4 complete

---

## Overview

Viết tài liệu AGI Standard Operating Procedures cho team.

---

## Requirements

### Documents to Create
1. `docs/agi-sops.md` - Main SOPs
2. `docs/local-llm-setup.md` - Setup guide
3. `docs/llm-api.md` - API reference

---

## SOP Content

### 1. Model Selection SOP

| Task | Model |
|------|-------|
| Simple Q&A | llama-3.2-1b |
| Creative writing | llama-3.2-3b |
| Code generation | codellama-7b |

### 2. Prompt Templates

```markdown
## Standard Format
### Context
### Task
### Constraints
### Output Format
```

### 3. Quality Gates

- Validate output length
- Check for hallucinations
- Verify code syntax

### 4. Error Recovery

| Error | Action |
|-------|--------|
| Timeout | Retry with shorter prompt |
| OOM | Use smaller model |
| Garbage output | Regenerate with temperature=0 |

---

## Related Code Files

**Create:**
- `docs/agi-sops.md`
- `docs/local-llm-setup.md`
- `docs/llm-api.md`

---

## Implementation Steps

1. Write main SOPs doc
2. Write setup guide
3. Write API reference
4. Add examples
5. Review and publish

---

## Todo List

- [ ] Write `docs/agi-sops.md`
- [ ] Write `docs/local-llm-setup.md`
- [ ] Write `docs/llm-api.md`
- [ ] Add code examples
- [ ] Link from README

---

## Success Criteria

- All 3 docs created
- Clear, actionable steps
- Examples included
- Team can follow without help

---

## Risk Assessment

| Risk | Impact | Mitigation |
|------|--------|------------|
| Outdated quickly | Medium | Add last-updated date |
| Too verbose | Low | Keep concise, use tables |
| Missing edge cases | Medium | Add troubleshooting FAQ |

---

## Security Considerations

- Document security best practices
- Include data privacy guidelines
- Note compliance requirements

---

## Next Steps

→ Plan complete. Ready for production use.
