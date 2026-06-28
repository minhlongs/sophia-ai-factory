# Phase 1: Foundation Setup

**Priority**: CRITICAL
**Status**: IN_PROGRESS
**Phase**: setup

---

## Context Links

- Plan: `./plan.md`
- DNA Transformer: `~/mekong-cli/scripts/claudekit-dna-transformer.sh`
- DNA Documentation: `~/mekong-cli/plans/dna-transformer-documentation.md`

---

## Overview

Establish infrastructure for cloning, managing, and transforming external power sources into AgencyOS DNA format. Create automated sync system that integrates with existing DNA Transformer.

---

## Key Insights

- DNA Transformer already exists - extend it for external sources
- Use similar Binh Pháp mapping for power sources
- Need separate directory structure from claudekit-engineer
- Daily sync critical for staying current with upstream

---

## Requirements

### Functional
- Clone 13 external repositories to structured location
- Daily automated pull from all sources
- Transform files to AgencyOS DNA format
- Generate sync changelog
- Integrate with existing DNA Transformer pipeline

### Non-Functional
- Sync time <5 minutes for all sources
- Resilient to individual repo failures
- Logs all operations
- Dry-run mode for testing

---

## Architecture

```
~/mekong-cli/.claude/
├── claudekit-engineer/           (existing)
├── external-sources/              (NEW)
│   ├── tier1/
│   │   ├── superclaude/
│   │   ├── zen-mcp-server/
│   │   ├── repomix/
│   │   └── opencode/
│   ├── tier2/
│   │   ├── ragflow/
│   │   ├── pathway/
│   │   ├── agno/
│   │   ├── pydantic-ai/
│   │   └── agentflow/
│   └── tier3/
│       ├── claude-code-sessions/
│       ├── awesome-claude-code-plugins/
│       ├── worktrunk/
│       ├── mgrep/
│       └── playwright-skill/
└── settings.json

~/mekong-cli/scripts/
├── claudekit-dna-transformer.sh   (existing)
└── power-source-syncer.sh         (NEW)

~/mekong-cli/plans/
└── external-sources-sync-log.md   (NEW)
```

---

## Related Code Files

### To Create
- `~/mekong-cli/scripts/power-source-syncer.sh`
- `~/mekong-cli/plans/external-sources-sync-log.md`
- `~/Library/LaunchAgents/com.agencyos.power-source-syncer.plist`

### To Modify
- None (standalone system)

---

## Implementation Steps

### 1. Create Directory Structure
```bash
mkdir -p ~/mekong-cli/.claude/external-sources/{tier1,tier2,tier3}
```

### 2. Build Power Source Registry
Create associative array mapping source name → GitHub URL → tier

### 3. Implement Cloning Logic
- Check if repo exists (skip if present)
- Clone to appropriate tier directory
- Handle errors gracefully (log, continue)

### 4. Implement Pull Logic
- For each existing repo: `git pull origin main`
- Track commits pulled
- Log changes

### 5. Add DNA Transformation
- Similar header to claudekit-dna-transformer.sh
- Map sources to Binh Pháp chapters
- Add metadata: source tier, upstream URL

### 6. Generate Changelog
- Sources synced
- Commits pulled per source
- Files transformed
- Timestamp

### 7. Create LaunchAgent
- Daily execution at 6:15 AM (15 min after claudekit)
- Logs to ~/mekong-cli/logs/power-source-sync.log

### 8. Test with Dry Run
- Verify all repos clone correctly
- Test transformation format
- Validate changelog generation

---

## Todo List

- [ ] Create external-sources directory structure
- [ ] Define power source registry (13 sources)
- [ ] Implement clone logic with error handling
- [ ] Implement pull logic with commit tracking
- [ ] Add DNA transformation headers
- [ ] Generate sync changelog
- [ ] Create LaunchAgent plist
- [ ] Test dry-run mode
- [ ] Execute real run for Tier 1
- [ ] Verify Tier 1 integration

---

## Success Criteria

- ✅ Directory structure created
- ✅ All 13 source URLs mapped correctly
- ✅ Script clones all repos without errors
- ✅ DNA headers applied to transformed files
- ✅ Changelog generated with commit log
- ✅ Dry-run test passes
- ✅ Real execution syncs Tier 1 sources
- ✅ LaunchAgent configured for daily automation

---

## Risk Assessment

**Risk 1**: Repository URL changes/deprecation
- Mitigation: Log failures, continue with other sources

**Risk 2**: Git conflicts during pull
- Mitigation: Use `git pull --ff-only`, fall back to re-clone

**Risk 3**: Large repos (slow clone)
- Mitigation: Clone depth=1 for shallow clones

**Risk 4**: Disk space consumption
- Mitigation: Monitor, add cleanup logic for old clones

---

## Security Considerations

- Clone from GitHub only (trusted source)
- No automatic code execution
- Read-only access (pulling only)
- Logs sensitive operations

---

## Next Steps

1. Implement power-source-syncer.sh
2. Test with Tier 1 sources
3. Move to Phase 2 (Tier 1 Integration)
