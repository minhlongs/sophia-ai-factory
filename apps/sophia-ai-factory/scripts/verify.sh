#!/bin/bash

# Verify Script Wrapper

# Check for Node.js
if ! command -v node &> /dev/null; then
    echo "Error: Node.js is not installed."
    exit 1
fi

# Run the Node script
node scripts/health-check.js
