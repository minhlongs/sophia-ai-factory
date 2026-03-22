#!/bin/bash
# Sophia AI Factory — Sync M1 Max
# Run this when M1 Max (192.168.11.111) is online
# Password: 4 spaces ("    ")

set -e

M1_MAX="macbook@192.168.11.111"
DEPLOY_DIR="/tmp/sophia-cf-deploy"
SOURCE_DIR="~/mekong-cli/apps/sophia-proposal"

echo "=== Syncing M1 Max with latest Sophia AI Factory ==="

# Step 1: Pull deploy repo
echo "[1/3] Pulling deploy repo..."
sshpass -p '    ' ssh -o StrictHostKeyChecking=no "$M1_MAX" "cd $DEPLOY_DIR && git pull origin main"

# Step 2: Sync source directory
echo "[2/3] Syncing source directory..."
sshpass -p '    ' ssh -o StrictHostKeyChecking=no "$M1_MAX" "cd $SOURCE_DIR 2>/dev/null && git pull origin main 2>/dev/null || echo 'Source dir not a git repo — using rsync from deploy'"
sshpass -p '    ' ssh -o StrictHostKeyChecking=no "$M1_MAX" "rsync -av --exclude=node_modules --exclude=.next --exclude=.open-next $DEPLOY_DIR/apps/sophia-proposal/ $SOURCE_DIR/"

# Step 3: Verify
echo "[3/3] Verifying..."
sshpass -p '    ' ssh -o StrictHostKeyChecking=no "$M1_MAX" "cat $DEPLOY_DIR/apps/sophia-proposal/package.json | grep -E '\"next\"|\"react\"'"
sshpass -p '    ' ssh -o StrictHostKeyChecking=no "$M1_MAX" "ls -la $DEPLOY_DIR/apps/sophia-proposal/open-next.config.ts"

echo ""
echo "=== Done! M1 Max synced to commit: ==="
sshpass -p '    ' ssh -o StrictHostKeyChecking=no "$M1_MAX" "cd $DEPLOY_DIR && git log --oneline -1"
