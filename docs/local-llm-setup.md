# Local LLM Setup Guide

**Platform:** macOS (Apple Silicon M1/M2/M3)

---

## 1. Install Ollama

### Via Homebrew (Recommended)

```bash
# Install
brew install ollama

# Start service
brew services start ollama

# Verify
ollama --version
```

### Via Download

```bash
# Download from https://ollama.ai
# Drag to Applications
# Run Ollama from Applications folder
```

---

## 2. Download Models

```bash
# List available models
ollama list

# Pull specific model
ollama pull llama3.2:3b

# Pull code model
ollama pull codellama:7b

# Delete model
ollama rm llama3.2:1b
```

### Recommended Models

| Model | Size | Use Case |
|-------|------|----------|
| llama3.2:1b | 1.3GB | Fast responses |
| llama3.2:3b | 2.4GB | Balanced |
| mistral:7b | 4.7GB | Quality |
| codellama:7b | 4.7GB | Code |

---

## 3. Configure Environment

### Create `.env.local`

```bash
# Copy from example
cp .env.example .env.local
```

### Edit `.env.local`

```bash
# Local Ollama
LLM_BASE_URL=http://localhost:11434/v1
LLM_MODEL=llama3.2:3b
LLM_API_KEY=ollama
```

---

## 4. Test Connection

```bash
# Test Ollama API
curl http://localhost:11434/api/generate -d '{
  "model": "llama3.2:3b",
  "prompt": "Hello",
  "stream": false
}'

# Test Sophia API (after pnpm dev)
curl http://localhost:3000/api/generate -X POST -H 'Content-Type: application/json' -d '{
  "prompt": "Hello"
}'
```

---

## 5. Run Sophia AI Factory

```bash
# Install dependencies
pnpm install

# Start dev server
pnpm dev

# Open browser
open http://localhost:3000
```

Navigate to `/chat` route to use LLM Chat.

---

## 6. Troubleshooting

### Ollama Not Starting

```bash
# Check if running
ps aux | grep ollama

# Kill and restart
brew services stop ollama
brew services start ollama
```

### Model Not Found

```bash
# Pull again
ollama pull llama3.2:3b

# List installed
ollama list
```

### Port Conflict

```bash
# Check what's using port 11434
lsof -i :11434

# Change Ollama port (in ~/.ollama/config)
OLLAMA_HOST=0.0.0.0:11435
```

---

## 7. Performance Tuning

### Memory Management

```bash
# Stop unused models
ollama stop codellama:7b

# Check running models
ollama ps
```

### GPU Acceleration (M1/M2/M3)

Ollama tự động sử dụng GPU Apple Silicon. Để optimize:

- Close other GPU apps
- Use Metal-friendly models
- Keep macOS updated

---

## 8. Update & Maintenance

```bash
# Update Ollama
brew upgrade ollama

# Update models
ollama pull llama3.2:3b  # Re-pull latest

# Clean old models
ollama rm <model-name>
```

---

## Next Steps

→ See [AGI SOPs](./agi-sops.md) for usage guidelines
→ See [LLM API Reference](./llm-api.md) for API docs
