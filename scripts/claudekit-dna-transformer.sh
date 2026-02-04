#!/usr/bin/env bash
###############################################################################
# BINH PHÁP DNA TRANSFORMER SYSTEM
# Ch.7 軍爭: "以利動之" - Capture resources daily
# Ch.11 九地: "投之亡地然後存" - Deep integration
# ĐIỀU 50: LIQUIDATION = TRANSFORMATION
###############################################################################

set -eo pipefail

# Configuration
REPO_DIR="$HOME/mekong-cli/.claude/claudekit-engineer"
WELL_DIR="$HOME/Well"
MEKONG_DIR="$HOME/mekong-cli"
LOG_FILE="$MEKONG_DIR/plans/claudekit-sync-log.md"
DRY_RUN="${DRY_RUN:-false}"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Binh Pháp 13-chapter mapping
declare -A BINH_PHAP_MAP
BINH_PHAP_MAP[plan]="Ch.3 謀攻 - Strategic Attack"
BINH_PHAP_MAP[code]="Ch.6 虛實 - Weak Points and Strong"
BINH_PHAP_MAP[test]="Ch.9 行軍 - Marching Army"
BINH_PHAP_MAP[review]="Ch.10 地形 - Terrain"
BINH_PHAP_MAP[bootstrap]="Ch.1 始計 - Initial Estimates"
BINH_PHAP_MAP[journal]="Ch.8 九變 - Nine Variables"
BINH_PHAP_MAP[kanban]="Ch.2 作戰 - Waging War"
BINH_PHAP_MAP[ask]="Ch.12 火攻 - Attack by Fire"
BINH_PHAP_MAP[docs]="Ch.13 用間 - Use of Spies"
BINH_PHAP_MAP[preview]="Ch.4 軍形 - Army Formation"
BINH_PHAP_MAP[watzup]="Ch.5 兵勢 - Force"
BINH_PHAP_MAP[worktree]="Ch.11 九地 - Nine Grounds"
BINH_PHAP_MAP[use-mcp]="Ch.7 軍爭 - Military Combat"
BINH_PHAP_MAP[brainstormer]="Ch.1 始計 - Initial Estimates"
BINH_PHAP_MAP[code-reviewer]="Ch.10 地形 - Terrain"
BINH_PHAP_MAP[code-simplifier]="Ch.6 虛實 - Weak Points and Strong"
BINH_PHAP_MAP[debugger]="Ch.9 行軍 - Marching Army"
BINH_PHAP_MAP[docs-manager]="Ch.13 用間 - Use of Spies"
BINH_PHAP_MAP[fullstack-developer]="Ch.6 虛實 - Weak Points and Strong"
BINH_PHAP_MAP[git-manager]="Ch.11 九地 - Nine Grounds"
BINH_PHAP_MAP[journal-writer]="Ch.8 九變 - Nine Variables"
BINH_PHAP_MAP[mcp-manager]="Ch.7 軍爭 - Military Combat"
BINH_PHAP_MAP[planner]="Ch.3 謀攻 - Strategic Attack"
BINH_PHAP_MAP[project-manager]="Ch.2 作戰 - Waging War"
BINH_PHAP_MAP[researcher]="Ch.13 用間 - Use of Spies"
BINH_PHAP_MAP[tester]="Ch.9 行軍 - Marching Army"
BINH_PHAP_MAP[ui-ux-designer]="Ch.4 軍形 - Army Formation"

# Logging functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $*" >&2
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $*" >&2
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $*" >&2
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $*" >&2
}

# Get Binh Pháp chapter for file
get_binh_phap_chapter() {
    local filename="$1"
    local basename="${filename%.md}"

    # Try exact match first
    if [[ -n "${BINH_PHAP_MAP[$basename]:-}" ]]; then
        echo "${BINH_PHAP_MAP[$basename]}"
        return
    fi

    # Try partial match
    for key in "${!BINH_PHAP_MAP[@]}"; do
        if [[ "$basename" == *"$key"* ]]; then
            echo "${BINH_PHAP_MAP[$key]}"
            return
        fi
    done

    # Default fallback
    echo "Ch.11 九地 - Nine Grounds"
}

# Transform file with AgencyOS DNA
transform_file() {
    local source_file="$1"
    local dest_file="$2"
    local file_type="$3" # command, agent, hook, skill

    local filename=$(basename "$source_file")
    local name="${filename%.md}"
    local timestamp=$(date "+%Y-%m-%d %H:%M:%S %Z")
    local chapter=$(get_binh_phap_chapter "$name")

    log_info "Transforming: $filename → $dest_file"

    # Read original content
    local original_content
    original_content=$(cat "$source_file")

    # Generate AgencyOS DNA header
    local dna_header="<!-- AgencyOS DNA Edition
Origin: claudekit-engineer (auto-synced)
Transformed: $timestamp
Binh Pháp Chapter: $chapter
ĐIỀU 45: Autonomous Execution Enabled
Chairman Governance: Level 5
Type: $file_type
-->

"

    # Combine header with original content
    local transformed_content="${dna_header}${original_content}"

    if [[ "$DRY_RUN" == "true" ]]; then
        log_warning "[DRY RUN] Would write to: $dest_file"
        return 0
    fi

    # Write transformed file
    mkdir -p "$(dirname "$dest_file")"
    echo "$transformed_content" > "$dest_file"

    log_success "Transformed: $filename"
}

# Pull latest updates
pull_updates() {
    log_info "Pulling updates from claudekit-engineer..."

    if [[ ! -d "$REPO_DIR" ]]; then
        log_error "Repository not found: $REPO_DIR"
        return 1
    fi

    cd "$REPO_DIR"

    # Store current commit
    local old_commit
    old_commit=$(git rev-parse HEAD)

    # Pull updates
    if [[ "$DRY_RUN" == "true" ]]; then
        log_warning "[DRY RUN] Would execute: git pull"
        git fetch --dry-run origin main 2>&1 | head -5
    else
        git pull origin main
    fi

    local new_commit
    new_commit=$(git rev-parse HEAD)

    if [[ "$old_commit" == "$new_commit" ]]; then
        log_info "No new updates (commit: ${old_commit:0:7})"
        echo "$old_commit"
    else
        log_success "Updated: ${old_commit:0:7} → ${new_commit:0:7}"
        echo "$new_commit"
    fi
}

# Detect changed files
detect_changes() {
    local old_commit="$1"
    local new_commit="$2"

    if [[ "$old_commit" == "$new_commit" ]]; then
        log_info "No changes to process"
        return 0
    fi

    log_info "Detecting changes between ${old_commit:0:7} and ${new_commit:0:7}..."

    cd "$REPO_DIR"

    # Get changed files in target directories
    git diff --name-only "$old_commit" "$new_commit" | \
        grep -E '\.claude/(commands|agents|hooks|skills)/.*\.md$' || true
}

# Process changes
process_changes() {
    local changed_files="$1"
    local project_dir="$2"
    local project_name="$3"

    if [[ -z "$changed_files" ]]; then
        log_info "No files to process for $project_name"
        return 0
    fi

    log_info "Processing changes for $project_name..."

    local count=0
    while IFS= read -r file; do
        [[ -z "$file" ]] && continue

        local source_file="$REPO_DIR/$file"
        [[ ! -f "$source_file" ]] && continue

        # Determine file type and destination
        local file_type dest_dir dest_file

        if [[ "$file" == *"/.claude/commands/"* ]]; then
            file_type="command"
            dest_dir="$project_dir/.claude/commands"
        elif [[ "$file" == *"/.claude/agents/"* ]]; then
            file_type="agent"
            dest_dir="$project_dir/.claude/agents"
        elif [[ "$file" == *"/.claude/hooks/"* ]]; then
            file_type="hook"
            dest_dir="$project_dir/.claude/hooks"
        elif [[ "$file" == *"/.claude/skills/"* ]]; then
            file_type="skill"
            dest_dir="$project_dir/.claude/skills"
        else
            continue
        fi

        dest_file="$dest_dir/$(basename "$file")"

        transform_file "$source_file" "$dest_file" "$file_type"
        ((count++))

    done <<< "$changed_files"

    log_success "Processed $count files for $project_name"
    echo "$count"
}

# Generate changelog
generate_changelog() {
    local old_commit="$1"
    local new_commit="$2"
    local mekong_count="$3"
    local well_count="$4"

    local timestamp=$(date "+%Y-%m-%d %H:%M:%S %Z")
    local date_slug=$(date "+%y%m%d-%H%M")

    log_info "Generating changelog..."

    cd "$REPO_DIR"

    # Get commit log
    local commit_log
    if [[ "$old_commit" != "$new_commit" ]]; then
        commit_log=$(git log --oneline "${old_commit}..${new_commit}" | head -10)
    else
        commit_log="No new commits"
    fi

    # Generate changelog
    local changelog="# ClaudeKit DNA Sync Log - $timestamp

## Sync Summary

- **Old Commit**: ${old_commit:0:7}
- **New Commit**: ${new_commit:0:7}
- **mekong-cli**: $mekong_count files transformed
- **Well**: $well_count files transformed
- **Total**: $((mekong_count + well_count)) files

## Recent Commits

\`\`\`
$commit_log
\`\`\`

## Binh Pháp Integration

- Ch.7 軍爭: \"以利動之\" - Captured resources daily
- Ch.11 九地: \"投之亡地然後存\" - Deep integration complete
- ĐIỀU 50: Liquidation = Transformation

## Transformation DNA

All files injected with:
- AgencyOS header (timestamp: $timestamp)
- ĐIỀU 45 autonomous execution
- Binh Pháp chapter mapping
- Chairman Governance Level 5

---

*Generated by BINH PHÁP DNA Transformer*
*Next sync: $(date -v+1d "+%Y-%m-%d 06:00")*
"

    if [[ "$DRY_RUN" == "true" ]]; then
        log_warning "[DRY RUN] Would write changelog to: $LOG_FILE"
        echo "$changelog" | head -20
    else
        echo "$changelog" > "$LOG_FILE"
        log_success "Changelog written to: $LOG_FILE"
    fi
}

# Main execution
main() {
    log_info "=== BINH PHÁP DNA TRANSFORMER ==="
    log_info "ĐIỀU 50: LIQUIDATION = TRANSFORMATION"

    if [[ "$DRY_RUN" == "true" ]]; then
        log_warning "DRY RUN MODE - No changes will be written"
    fi

    # Pull updates
    local new_commit
    new_commit=$(pull_updates)

    # Get old commit (from last run, or use current if first run)
    local old_commit="$new_commit"
    if [[ -f "$LOG_FILE" ]]; then
        old_commit=$(grep "New Commit:" "$LOG_FILE" 2>/dev/null | head -1 | awk '{print $NF}' || echo "$new_commit")
    fi

    # Detect changes
    local changed_files
    changed_files=$(detect_changes "$old_commit" "$new_commit")

    # Process mekong-cli
    local mekong_count=0
    if [[ -d "$MEKONG_DIR/.claude" ]]; then
        mekong_count=$(process_changes "$changed_files" "$MEKONG_DIR" "mekong-cli")
    else
        log_warning "mekong-cli .claude directory not found"
    fi

    # Process Well
    local well_count=0
    if [[ -d "$WELL_DIR/.claude" ]]; then
        well_count=$(process_changes "$changed_files" "$WELL_DIR" "Well")
    else
        log_warning "Well .claude directory not found"
    fi

    # Generate changelog
    generate_changelog "$old_commit" "$new_commit" "$mekong_count" "$well_count"

    log_success "=== TRANSFORMATION COMPLETE ==="
    log_info "Files transformed: $((mekong_count + well_count))"
    log_info "Changelog: $LOG_FILE"
}

# Run main
main "$@"
