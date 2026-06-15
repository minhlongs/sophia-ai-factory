# BINH PHÁP DNA Transformer System - Documentation

**Created**: 2026-01-30 00:21
**Version**: 1.0.0
**Purpose**: Automated daily synchronization and transformation of claudekit-engineer assets

---

## Overview

The DNA Transformer system automatically:
1. Pulls latest updates from `github.com/claudekit/claudekit-engineer`
2. Detects new/changed files in `.claude/` directories
3. Transforms files with AgencyOS DNA headers
4. Injects Binh Pháp philosophy and ĐIỀU 45 autonomous execution
5. Copies transformed files to mekong-cli and Well projects
6. Generates sync changelog

---

## Architecture

### Components

**Script**: `~/mekong-cli/scripts/claudekit-dna-transformer.sh`
- Main transformation logic
- Binh Pháp 13-chapter mapping
- Git operations
- File processing

**LaunchAgent**: `~/Library/LaunchAgents/com.agencyos.claudekit-dna-transformer.plist`
- macOS scheduler (launchd)
- Daily execution at 6:00 AM
- Auto-restart on failure

**Logs**: `~/mekong-cli/logs/`
- `dna-transformer.log` - Combined output
- `dna-transformer-stdout.log` - Standard output
- `dna-transformer-stderr.log` - Errors/warnings

**Changelog**: `~/mekong-cli/plans/claudekit-sync-log.md`
- Sync summary
- Commit log
- File counts

---

## DNA Transformation Format

Each transformed file receives this header:

```markdown
<!-- AgencyOS DNA Edition
Origin: claudekit-engineer (auto-synced)
Transformed: 2026-01-30 00:15:00 +07
Binh Pháp Chapter: Ch.3 謀攻 - Strategic Attack
ĐIỀU 45: Autonomous Execution Enabled
Chairman Governance: Level 5
Type: command
-->

[Original file content...]
```

---

## Binh Pháp Mapping (13 Chapters)

| File | Chapter | Meaning |
|------|---------|---------|
| plan.md | Ch.3 謀攻 | Strategic Attack |
| code.md | Ch.6 虛實 | Weak Points and Strong |
| test.md | Ch.9 行軍 | Marching Army |
| review.md | Ch.10 地形 | Terrain |
| bootstrap.md | Ch.1 始計 | Initial Estimates |
| journal.md | Ch.8 九變 | Nine Variables |
| kanban.md | Ch.2 作戰 | Waging War |
| ask.md | Ch.12 火攻 | Attack by Fire |
| docs.md | Ch.13 用間 | Use of Spies |
| preview.md | Ch.4 軍形 | Army Formation |
| watzup.md | Ch.5 兵勢 | Force |
| worktree.md | Ch.11 九地 | Nine Grounds |
| use-mcp.md | Ch.7 軍爭 | Military Combat |

**Agents** follow similar mapping (brainstormer → Ch.1, planner → Ch.3, etc.)

---

## Usage

### Manual Execution

```bash
# Dry run (no changes written)
cd ~/mekong-cli
DRY_RUN=true ./scripts/claudekit-dna-transformer.sh

# Real run
./scripts/claudekit-dna-transformer.sh

# Check logs
tail -f logs/dna-transformer.log
```

### Automated Execution (launchd)

```bash
# Load the agent (enable daily automation)
launchctl load ~/Library/LaunchAgents/com.agencyos.claudekit-dna-transformer.plist

# Unload (disable automation)
launchctl unload ~/Library/LaunchAgents/com.agencyos.claudekit-dna-transformer.plist

# Check status
launchctl list | grep claudekit-dna-transformer

# Manual trigger (test without waiting for 6 AM)
launchctl start com.agencyos.claudekit-dna-transformer

# View logs
tail -f ~/mekong-cli/logs/dna-transformer-stdout.log
tail -f ~/mekong-cli/logs/dna-transformer-stderr.log
```

---

## Schedule

**Pattern**: `0 6 * * *` (Daily at 6:00 AM)

**Execution Flow**:
1. 06:00 - launchd triggers script
2. 06:00:01 - Pull latest from claudekit-engineer
3. 06:00:05 - Detect changed files
4. 06:00:10 - Transform and copy files
5. 06:00:15 - Generate changelog
6. 06:00:20 - Complete

**Duration**: ~20 seconds (varies with changes)

---

## File Targets

Monitors and transforms files in:

```
.claude/claudekit-engineer/.claude/
├── commands/  → ~/mekong-cli/.claude/commands/
│              → ~/Well/.claude/commands/
├── agents/    → ~/mekong-cli/.claude/agents/
│              → ~/Well/.claude/agents/
├── hooks/     → ~/mekong-cli/.claude/hooks/
│              → ~/Well/.claude/hooks/
└── skills/    → ~/mekong-cli/.claude/skills/
               → ~/Well/.claude/skills/
```

**Only .md files are transformed** (not .js, .cjs, .sh, etc.)

---

## Error Handling

### Common Issues

**1. Repository Not Found**
```bash
[ERROR] Repository not found: ~/mekong-cli/.claude/claudekit-engineer
```
**Fix**: Ensure claudekit-engineer is cloned:
```bash
cd ~/mekong-cli/.claude
git clone https://github.com/claudekit/claudekit-engineer
```

**2. Git Pull Fails**
```bash
[ERROR] Git pull failed
```
**Fix**: Check internet connection, resolve merge conflicts manually

**3. Permission Denied**
```bash
Permission denied: ~/Well/.claude/commands/
```
**Fix**: Check directory permissions:
```bash
chmod 755 ~/Well/.claude/commands/
```

---

## Verification

After execution, verify:

```bash
# 1. Check changelog
cat ~/mekong-cli/plans/claudekit-sync-log.md

# 2. Verify transformed files
grep "AgencyOS DNA Edition" ~/mekong-cli/.claude/commands/*.md | head -5

# 3. Check file counts
find ~/mekong-cli/.claude/commands -name "*.md" -newer ~/mekong-cli/plans/claudekit-sync-log.md

# 4. Review logs
grep ERROR ~/mekong-cli/logs/dna-transformer.log
```

---

## Customization

### Change Schedule

Edit plist file:
```xml
<key>StartCalendarInterval</key>
<dict>
    <key>Hour</key>
    <integer>6</integer>  <!-- Change hour here -->
    <key>Minute</key>
    <integer>0</integer>  <!-- Change minute here -->
</dict>
```

Then reload:
```bash
launchctl unload ~/Library/LaunchAgents/com.agencyos.claudekit-dna-transformer.plist
launchctl load ~/Library/LaunchAgents/com.agencyos.claudekit-dna-transformer.plist
```

### Add More Binh Pháp Mappings

Edit script line 26-53, add entries:
```bash
BINH_PHAP_MAP[your-command]="Ch.X - Description"
```

### Exclude Projects

Comment out project processing in main() function:
```bash
# # Process Well
# local well_count=0
# if [[ -d "$WELL_DIR/.claude" ]]; then
#     well_count=$(process_changes "$changed_files" "$WELL_DIR" "Well")
# fi
```

---

## BINH PHÁP Principles

### Ch.7 軍爭 - "以利動之"
"Capture resources daily" - Automated daily sync ensures continuous access to latest improvements.

### Ch.11 九地 - "投之亡地然後存"
"Deep integration" - Transformation embeds AgencyOS DNA into every asset, creating unified command structure.

### ĐIỀU 50 - Liquidation = Transformation
Autonomous execution without human approval. System self-improves daily.

---

## Maintenance

### Weekly

```bash
# Check sync log
cat ~/mekong-cli/plans/claudekit-sync-log.md

# Review transformed files
ls -lt ~/mekong-cli/.claude/commands/ | head -10
```

### Monthly

```bash
# Archive old logs
mv ~/mekong-cli/logs/dna-transformer.log \
   ~/mekong-cli/logs/dna-transformer-$(date +%Y%m).log

# Verify launchd status
launchctl list | grep claudekit
```

---

## Troubleshooting

### Script Not Running

```bash
# Check if loaded
launchctl list | grep claudekit-dna-transformer

# Check logs for errors
cat ~/mekong-cli/logs/dna-transformer-stderr.log

# Test manually
DRY_RUN=true ~/mekong-cli/scripts/claudekit-dna-transformer.sh
```

### No Files Transformed

**Possible Causes**:
1. No new commits in claudekit-engineer
2. Changes in non-.md files
3. Changes outside monitored directories

**Verify**:
```bash
cd ~/mekong-cli/.claude/claudekit-engineer
git log --oneline -10
git diff HEAD~1 HEAD --name-only | grep ".claude/"
```

---

## Security

### Protected Directories

Script uses `set -eo pipefail` for fail-fast on errors.

### Git Safety

- Only pulls from main branch
- Never force-pushes
- Preserves existing files (overwrites only)

### File Permissions

Transformed files inherit source permissions (usually 644).

---

## Uninstallation

```bash
# 1. Unload launchd agent
launchctl unload ~/Library/LaunchAgents/com.agencyos.claudekit-dna-transformer.plist

# 2. Remove files
rm ~/Library/LaunchAgents/com.agencyos.claudekit-dna-transformer.plist
rm ~/mekong-cli/scripts/claudekit-dna-transformer.sh

# 3. Optional: Remove transformed files
# (Manually review and remove files with "AgencyOS DNA Edition" headers)
```

---

**Generated**: 2026-01-30 00:21
**Maintained by**: BINH PHÁP DNA Transformer System
**Next Review**: Weekly (check sync logs)
