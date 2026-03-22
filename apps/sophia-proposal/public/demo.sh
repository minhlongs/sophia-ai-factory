#!/usr/bin/env bash
# Sophia AI Factory — API Demo
# Usage: bash demo.sh [API_KEY]
# If no API_KEY provided, creates a new org via /api/v1/onboard

set -euo pipefail

BASE_URL="${SOPHIA_URL:-https://sophia-ai-factory.agencyos-openclaw.workers.dev}"
API_KEY="${1:-}"

# JSON pretty-print helper (graceful fallback if python3 unavailable)
pp() { python3 -m json.tool 2>/dev/null || cat; }

echo "=== Sophia AI Factory — API Demo ==="
echo "Base URL: $BASE_URL"
echo ""

# Step 0: Health check
echo "--- Step 0: Health Check ---"
curl -s "$BASE_URL/api/health" | pp
echo ""

# Step 1: Onboard (if no API key)
if [ -z "$API_KEY" ]; then
  echo "--- Step 1: Self-Service Onboard ---"
  ONBOARD=$(curl -s -X POST "$BASE_URL/api/v1/onboard" \
    -H "Content-Type: application/json" \
    -d '{"org_name": "Demo Agency", "email": "demo@example.com", "password": "demo1234"}')
  echo "$ONBOARD" | pp
  API_KEY=$(echo "$ONBOARD" | python3 -c "import sys,json; print(json.load(sys.stdin).get('api_key',''))" 2>/dev/null || echo "")
  if [ -z "$API_KEY" ]; then
    echo "ERROR: Failed to get API key from onboard response"
    exit 1
  fi
  echo "API Key: $API_KEY"
  echo ""
fi

# Step 2: Create a mission
echo "--- Step 2: Create Mission (proposal:create) ---"
MISSION=$(curl -s -X POST "$BASE_URL/api/v1/missions" \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"command": "proposal:create", "params": {"client_name": "Acme Corp", "service": "AI-Powered Marketing Automation", "budget": "$5,000/mo"}, "title": "Demo Proposal for Acme Corp"}')
echo "$MISSION" | pp
MISSION_ID=$(echo "$MISSION" | python3 -c "import sys,json; print(json.load(sys.stdin).get('mission_id',''))" 2>/dev/null || echo "")
echo ""

# Step 3: Poll mission status
if [ -n "$MISSION_ID" ]; then
  echo "--- Step 3: Poll Mission Status ---"
  for i in 1 2 3; do
    sleep 2
    STATUS=$(curl -s "$BASE_URL/api/v1/missions/$MISSION_ID" \
      -H "Authorization: Bearer $API_KEY")
    echo "Poll $i: $(echo "$STATUS" | python3 -c "import sys,json; d=json.load(sys.stdin); print(f\"status={d.get('status','?')}\")" 2>/dev/null || echo "$STATUS")"
  done
  echo ""

  # Step 4: Get result
  echo "--- Step 4: Get Mission Result ---"
  curl -s "$BASE_URL/api/v1/missions/$MISSION_ID/result" \
    -H "Authorization: Bearer $API_KEY" | pp
  echo ""
fi

# Step 5: Check usage (list missions)
echo "--- Step 5: Check Usage ---"
echo "Missions list:"
curl -s "$BASE_URL/api/v1/missions" \
  -H "Authorization: Bearer $API_KEY" | pp
echo ""

echo "=== Demo Complete ==="
echo "15 commands available: proposal:create, video:create, content:blog, content:social,"
echo "  sales:battlecard, sales:proposal-deck, sales:roi-calculator, and more."
echo ""
echo "Docs: $BASE_URL/docs/api"
echo "Signup: $BASE_URL/signup"
