# Coqui TTS Service — XTTS v2

Self-hosted voice synthesis microservice powering the Sophia AI Factory TTS pipeline.

## Stack

- Python 3.11 + FastAPI + Coqui TTS 0.22.0 (XTTS v2)
- Fly.io: `sophia-coqui-tts`, region `sin`, shared-cpu-2x, 4GB RAM

## Deploy Steps

```bash
# 1. Install flyctl
brew install flyctl   # macOS
# or: curl -L https://fly.io/install.sh | sh

# 2. Login
fly auth login

# 3. Deploy (first time)
cd services/coqui-tts
fly launch --no-deploy   # confirm app name = sophia-coqui-tts, region = sin
fly deploy

# 4. Set secrets
fly secrets set COQUI_INTERNAL_TOKEN="<generate-with-openssl-rand-hex-32>"

# 5. Check health
curl https://sophia-coqui-tts.fly.dev/health
```

## Environment Variables

| Variable              | Required | Description                          |
| --------------------- | -------- | ------------------------------------ |
| COQUI_INTERNAL_TOKEN  | Yes      | Shared secret with CF Worker proxy   |
| MODEL_NAME            | No       | Override XTTS v2 model path          |

## API

### POST /synth

```json
{
  "text": "Hello, world!",
  "language": "en",
  "voice_ref_url": null
}
```

Returns: `audio/wav` stream with `x-duration-sec` header.

### GET /health

Returns: `{"status": "ok", "model": "..."}`

## CF Worker Integration

Set `COQUI_FLY_URL=https://sophia-coqui-tts.fly.dev` in Cloudflare Worker secrets.
The `/api/internal/tts` route will proxy requests to this service.

## Notes

- XTTS v2 model downloads on first startup (~1.8GB). Machine stays warm due to `auto_stop_machines = false`.
- For GPU inference: upgrade to `performance-8x` VM on Fly.io or migrate to Lambda Labs.
- Voice cloning: pass a `voice_ref_url` pointing to a publicly accessible 6-sec WAV sample.
