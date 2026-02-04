#!/bin/bash
# Well CC CLI Launcher
# Starts Claude Code CLI with proper context for Well project

set -e

# Colors
GREEN='\033[0;32m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

echo -e "${CYAN}╔═══════════════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║       WELL DISTRIBUTOR PORTAL - CC CLI WORKER            ║${NC}"
echo -e "${CYAN}║   Controlled by Antigravity (Admin Brain)                ║${NC}"
echo -e "${CYAN}╚═══════════════════════════════════════════════════════════╝${NC}"
echo ""

# Navigate to Well project
cd ~/Well

echo -e "${GREEN}[INFO]${NC} Work Context: $(pwd)"
echo -e "${GREEN}[INFO]${NC} Reports: $(pwd)/plans/reports/"
echo -e "${GREEN}[INFO]${NC} Plans: $(pwd)/plans/"
echo ""
echo -e "${GREEN}[INFO]${NC} Starting CC CLI with full permissions..."
echo ""

# Start Claude CLI with dangerously-skip-permissions for automation
claude --dangerously-skip-permissions
