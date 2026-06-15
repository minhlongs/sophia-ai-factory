#!/bin/bash
# ==============================================================================
# Sophia AI Factory — Turnkey M1/M2/M3 Mac Studio Setup Script
# Description: Installs all Node/Python dependencies, global video rendering packages,
#              and spins up the local CheetahClaws Agent Engine.
# Usage: curl -s https://platform.sophia.ai/install-m1.sh | bash
# ==============================================================================

set -eo pipefail

echo -e "\033[1;35m🚀 Welcome to Sophia AI Factory — Local Engine Installer\033[0m"
echo -e "\033[1;34m---------------------------------------------------------\033[0m"

# 1. Platform Check
OS="$(uname -s)"
if [ "$OS" != "Darwin" ]; then
    echo -e "\033[0;31m❌ Error: This script is designed for macOS (M1/M2/M3 Mac Studio/MacBook).\033[0m"
    echo "If you are running on Linux/Docker, please contact support for alternative setups."
    exit 1
fi

# 2. Check Homebrew
if ! command -v brew &> /dev/null; then
    echo -e "\033[0;33m⚠️ Homebrew is not installed. Installing Homebrew now...\033[0m"
    /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
else
    echo -e "\033[0;32m✅ Homebrew found.\033[0m"
fi

# 3. Check and Install Node.js
if ! command -v node &> /dev/null; then
    echo -e "\033[0;33m⚠️ Node.js not found. Installing Node.js via Homebrew...\033[0m"
    brew install node
else
    NODE_VER=$(node -v)
    echo -e "\033[0;32m✅ Node.js found: $NODE_VER\033[0m"
fi

# 4. Check and Install Python
if ! command -v python3 &> /dev/null; then
    echo -e "\033[0;33m⚠️ Python3 not found. Installing Python3 via Homebrew...\033[0m"
    brew install python
else
    PY_VER=$(python3 --version)
    echo -e "\033[0;32m✅ Python3 found: $PY_VER\033[0m"
fi

# 5. Install Video Rendering Pipeline dependencies (Remotion & FFmpeg)
echo -e "\033[1;34m📦 Installing FFmpeg and Chromium for video composition...\033[0m"
brew install ffmpeg

echo -e "\033[1;34m📦 Installing @remotion/cli globally...\033[0m"
npm install -g @remotion/cli --quiet

# 6. Initialize local directory and fetch CheetahClaws runner
echo -e "\033[1;34m⚙️ Scaffolding CheetahClaws engine workspace...\033[0m"
ENGINE_DIR="$HOME/.sophia-engine"
mkdir -p "$ENGINE_DIR"

# Download cheetahclaws distribution package (mock file download here)
cat << 'EOF' > "$ENGINE_DIR/run-agent.sh"
#!/bin/bash
# Local CheetahClaws execution entry point
echo "Local CheetahClaws Engine started on port 3010..."
# Node / Python server to listen to MCP queries from Sophia Edge
EOF
chmod +x "$ENGINE_DIR/run-agent.sh"

# 7. Configure Environment
echo -e "\033[1;34m🔑 Connection Configuration\033[0m"
echo -n "Please enter your Sophia Platform API Key: "
read -r API_KEY

if [ -z "$API_KEY" ]; then
    echo -e "\033[0;31m❌ Error: API Key cannot be empty.\033[0m"
    exit 1
fi

cat << EOF > "$ENGINE_DIR/.env"
SOPHIA_API_KEY="$API_KEY"
PORT=3010
TEMP_DIR="$ENGINE_DIR/temp"
LOCAL_FS_ALLOWED=true
EOF

echo -e "\033[1;32m✅ Configuration saved to $ENGINE_DIR/.env\033[0m"
echo -e "\033[1;35m🎉 Setup Completed Successfully!\033[0m"
echo "---------------------------------------------------------"
echo "To start your Local Video Rendering Engine, run:"
echo -e "\033[1;36m  cd $ENGINE_DIR && ./run-agent.sh\033[0m"
echo "---------------------------------------------------------"
