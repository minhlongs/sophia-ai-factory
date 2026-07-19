#!/bin/bash

# Setup Script Wrapper
# Ensures Node.js is available and runs the interactive setup

# Check for Node.js
if ! command -v node &> /dev/null; then
    echo "Error: Node.js is not installed."
    echo "Please install Node.js v18 or later."
    exit 1
fi

# Run the Node script
node scripts/cli-setup.js
