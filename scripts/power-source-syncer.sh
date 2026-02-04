#!/usr/bin/env bash
###############################################################################
# AGENCYOS POWER SOURCE SYNCER
# Ch.13 用間: "必索敵人之間" - Use spies to capture enemy resources
# Ch.3 謀攻: "不戰而屈人之兵" - Win without fighting
# ĐIỀU 7: 軍爭 - Capture resources daily
###############################################################################

set -eo pipefail

# Configuration
SOURCES_DIR="$HOME/mekong-cli/.claude/external-sources"
LOG_FILE="$HOME/mekong-cli/plans/external-sources-sync-log.md"
DRY_RUN="${DRY_RUN:-false}"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Power Source Registry (Name → URL → Tier → Chapter)
declare -A SOURCES_TIER1
SOURCES_TIER1[superclaude]="https://github.com/SuperClaude-Org/SuperClaude_Framework|tier1|Ch.1 始計 - Initial Estimates"
SOURCES_TIER1[zen-mcp-server]="https://github.com/zenml-io/mcp-zenml|tier1|Ch.7 軍爭 - Military Combat"
SOURCES_TIER1[repomix]="https://github.com/yamadashy/repomix|tier1|Ch.13 用間 - Use of Spies"
SOURCES_TIER1[opencode]="https://github.com/opencode-ai/opencode|tier1|Ch.6 虛實 - Weak Points and Strong"

declare -A SOURCES_TIER2
SOURCES_TIER2[ragflow]="https://github.com/infiniflow/ragflow|tier2|Ch.13 用間 - Use of Spies"
SOURCES_TIER2[pathway]="https://github.com/pathwaycom/pathway|tier2|Ch.11 九地 - Nine Grounds"
SOURCES_TIER2[agno]="https://github.com/agno-agi/agno|tier2|Ch.6 虛實 - Weak Points and Strong"
SOURCES_TIER2[pydantic-ai]="https://github.com/pydantic/pydantic-ai|tier2|Ch.10 地形 - Terrain"
SOURCES_TIER2[browser-use]="https://github.com/browser-use/browser-use|tier2|Ch.2 作戰 - Waging War"

declare -A SOURCES_TIER3
SOURCES_TIER3[claude-code-sessions]="https://github.com/anthropics/claude-code-sessions|tier3|Ch.8 九變 - Nine Variables"
SOURCES_TIER3[awesome-claude-code]="https://github.com/anthropics/awesome-claude-code|tier3|Ch.13 用間 - Use of Spies"
SOURCES_TIER3[worktrunk]="https://github.com/worktrunk/worktrunk|tier3|Ch.11 九地 - Nine Grounds"
SOURCES_TIER3[mgrep]="https://github.com/mgrep/mgrep|tier3|Ch.13 用間 - Use of Spies"
SOURCES_TIER3[playwright-skill]="https://github.com/playwright/playwright-skill|tier3|Ch.9 行軍 - Marching Army"

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

# Get Binh Pháp chapter from registry
get_chapter() {
    local name="$1"
    local metadata="$2"
    echo "$metadata" | cut -d'|' -f3
}

# Clone or update source
sync_source() {
    local name="$1"
    local metadata="$2"

    local url=$(echo "$metadata" | cut -d'|' -f1)
    local tier=$(echo "$metadata" | cut -d'|' -f2)
    local chapter=$(echo "$metadata" | cut -d'|' -f3)

    local dest_dir="$SOURCES_DIR/$tier/$name"

    log_info "Syncing: $name ($tier)"

    if [[ ! -d "$dest_dir" ]]; then
        # Clone new repo
        log_info "Cloning from: $url"

        if [[ "$DRY_RUN" == "true" ]]; then
            log_warning "[DRY RUN] Would clone: $url → $dest_dir"
            echo "cloned|0|$chapter"
            return 0
        fi

        if git clone --depth 1 "$url" "$dest_dir" >&2; then
            log_success "Cloned: $name"
            echo "cloned|1|$chapter"
        else
            log_error "Failed to clone: $name"
            echo "failed|0|$chapter"
        fi
    else
        # Update existing repo
        cd "$dest_dir"

        local old_commit
        old_commit=$(git rev-parse HEAD 2>/dev/null || echo "unknown")

        if [[ "$DRY_RUN" == "true" ]]; then
            log_warning "[DRY RUN] Would pull: $name"
            echo "pulled|0|$chapter"
            return 0
        fi

        if git pull --ff-only origin main >&2 || git pull --ff-only origin master >&2; then
            local new_commit
            new_commit=$(git rev-parse HEAD)

            if [[ "$old_commit" == "$new_commit" ]]; then
                log_info "No updates: $name"
                echo "unchanged|0|$chapter"
            else
                local commit_count
                commit_count=$(git rev-list --count "${old_commit}..${new_commit}" 2>/dev/null || echo "0")
                log_success "Updated: $name (+$commit_count commits)"
                echo "pulled|$commit_count|$chapter"
            fi
        else
            log_error "Failed to pull: $name"
            echo "failed|0|$chapter"
        fi
    fi
}

# Sync all tiers
sync_all() {
    local total_sources=0
    local cloned=0
    local updated=0
    local unchanged=0
    local failed=0

    declare -A chapter_counts

    log_info "=== POWER SOURCE SYNCER ==="
    log_info "ĐIỀU 7: 軍爭 - Capture resources daily"

    if [[ "$DRY_RUN" == "true" ]]; then
        log_warning "DRY RUN MODE - No changes will be written"
    fi

    # Tier 1
    if [[ -z "$SYNC_TIER" || "$SYNC_TIER" == "1" ]]; then
        log_info "Syncing Tier 1 (MUST HAVE)..."
        for name in "${!SOURCES_TIER1[@]}"; do
            ((total_sources++))
            result=$(sync_source "$name" "${SOURCES_TIER1[$name]}")
            transform_source "$name" "${SOURCES_TIER1[$name]}"

            status=$(echo "$result" | cut -d'|' -f1)
            count=$(echo "$result" | cut -d'|' -f2)
            chapter=$(echo "$result" | cut -d'|' -f3)

            chapter_counts["$chapter"]=$((${chapter_counts["$chapter"]:-0} + 1))

            case "$status" in
                cloned) ((cloned++)) ;;
                pulled) ((updated++)) ;;
                unchanged) ((unchanged++)) ;;
                failed) ((failed++)) ;;
            esac
        done
    fi

    # Tier 2
    if [[ -z "$SYNC_TIER" || "$SYNC_TIER" == "2" ]]; then
        log_info "Syncing Tier 2 (HIGH VALUE)..."
        for name in "${!SOURCES_TIER2[@]}"; do
            ((total_sources++))
            result=$(sync_source "$name" "${SOURCES_TIER2[$name]}")
            transform_source "$name" "${SOURCES_TIER2[$name]}"

            status=$(echo "$result" | cut -d'|' -f1)
            count=$(echo "$result" | cut -d'|' -f2)
            chapter=$(echo "$result" | cut -d'|' -f3)

            chapter_counts["$chapter"]=$((${chapter_counts["$chapter"]:-0} + 1))

            case "$status" in
                cloned) ((cloned++)) ;;
                pulled) ((updated++)) ;;
                unchanged) ((unchanged++)) ;;
                failed) ((failed++)) ;;
            esac
        done
    fi

    # Tier 3
    if [[ -z "$SYNC_TIER" || "$SYNC_TIER" == "3" ]]; then
        log_info "Syncing Tier 3 (SPECIALIZED)..."
        for name in "${!SOURCES_TIER3[@]}"; do
            ((total_sources++))
            result=$(sync_source "$name" "${SOURCES_TIER3[$name]}")

            status=$(echo "$result" | cut -d'|' -f1)
            count=$(echo "$result" | cut -d'|' -f2)
            chapter=$(echo "$result" | cut -d'|' -f3)

            chapter_counts["$chapter"]=$((${chapter_counts["$chapter"]:-0} + 1))

            case "$status" in
                cloned) ((cloned++)) ;;
                pulled) ((updated++)) ;;
                unchanged) ((unchanged++)) ;;
                failed) ((failed++)) ;;
            esac
        done
    fi

    # Return stats
    echo "$total_sources|$cloned|$updated|$unchanged|$failed"
}

# Generate changelog
generate_changelog() {
    local stats="$1"

    local total=$(echo "$stats" | cut -d'|' -f1)
    local cloned=$(echo "$stats" | cut -d'|' -f2)
    local updated=$(echo "$stats" | cut -d'|' -f3)
    local unchanged=$(echo "$stats" | cut -d'|' -f4)
    local failed=$(echo "$stats" | cut -d'|' -f5)

    local timestamp=$(date "+%Y-%m-%d %H:%M:%S %Z")
    local date_slug=$(date "+%y%m%d-%H%M")

    log_info "Generating changelog..."

    local changelog="# External Power Sources Sync Log - $timestamp

## Sync Summary

- **Total Sources**: $total
- **Cloned**: $cloned
- **Updated**: $updated
- **Unchanged**: $unchanged
- **Failed**: $failed

## Source Breakdown

### Tier 1 (MUST HAVE) - 4 sources
- SuperClaude (cognitive personas)
- Zen MCP Server (multi-model orchestration)
- Repomix (repo packaging)
- OpenCode (ultrawork mode)

### Tier 2 (HIGH VALUE) - 5 sources
- RAGFlow (RAG + agents)
- Pathway (real-time LLM pipelines)
- Agno (multimodal agents)
- Pydantic AI (type-safe agents)
- AgentFlow (markdown workflows)

### Tier 3 (SPECIALIZED) - 5 sources
- Claude Code Sessions
- Awesome Claude Code
- Worktrunk (git worktree)
- mgrep (semantic grep)
- Playwright-skill

## Binh Pháp Integration

- Ch.13 用間: \"必索敵人之間\" - Captured enemy resources
- Ch.3 謀攻: \"不戰而屈人之兵\" - Won without fighting
- ĐIỀU 7: 軍爭 - Daily resource capture complete

## Strategic Advantage

These sources provide capabilities competitors don't know exist:
- Advanced cognitive structures (SuperClaude)
- Multi-model routing (Zen MCP)
- Codebase packaging (Repomix)
- Parallel AI development (OpenCode)

---

*Generated by AgencyOS Power Source Syncer*
*Next sync: $(date -v+1d "+%Y-%m-%d 06:15")*
"

    if [[ "$DRY_RUN" == "true" ]]; then
        log_warning "[DRY RUN] Would write changelog to: $LOG_FILE"
        echo "$changelog" | head -20
    else
        echo "$changelog" > "$LOG_FILE"
        log_success "Changelog written to: $LOG_FILE"
    fi
}

# Transform source with AgencyOS DNA
transform_source() {
    local name="$1"
    local metadata="$2"

    local tier=$(echo "$metadata" | cut -d'|' -f2)
    local chapter=$(echo "$metadata" | cut -d'|' -f3)
    local url=$(echo "$metadata" | cut -d'|' -f1)

    local dest_dir="$SOURCES_DIR/$tier/$name"
    local dna_file="$dest_dir/AGENCYOS_DNA.md"
    local timestamp=$(date "+%Y-%m-%d %H:%M:%S %Z")

    if [[ ! -d "$dest_dir" ]]; then
        return
    fi

    local content="# AgencyOS DNA: $name

**Origin**: $url
**Tier**: $tier
**Binh Pháp**: $chapter
**Synced**: $timestamp

## Strategic Analysis
This resource has been captured for the AgencyOS arsenal.

## Integration
- **Status**: Synced
- **Path**: $dest_dir
- **DNA Transformer**: Active

*Generated by AgencyOS Power Source Syncer*
"

    if [[ "$DRY_RUN" == "true" ]]; then
        log_warning "[DRY RUN] Would write DNA to: $dna_file"
    else
        echo "$content" > "$dna_file"
    fi
}

# Main execution
main() {
    log_info "=== AGENCYOS POWER SOURCE SYNCER ==="
    log_info "ĐIỀU 7: 軍爭 - Capture resources daily"

    if [[ "$DRY_RUN" == "true" ]]; then
        log_warning "DRY RUN MODE - No changes will be written"
    fi

    # Ensure directory structure
    mkdir -p "$SOURCES_DIR"/{tier1,tier2,tier3}

    # Sync all sources
    stats=$(sync_all)

    # Generate changelog
    generate_changelog "$stats"

    local total=$(echo "$stats" | cut -d'|' -f1)
    local cloned=$(echo "$stats" | cut -d'|' -f2)
    local updated=$(echo "$stats" | cut -d'|' -f3)
    local failed=$(echo "$stats" | cut -d'|' -f5)

    log_success "=== SYNC COMPLETE ==="
    log_info "Sources processed: $total"
    log_info "Cloned: $cloned | Updated: $updated | Failed: $failed"
    log_info "Changelog: $LOG_FILE"
}

# Run main
main "$@"
