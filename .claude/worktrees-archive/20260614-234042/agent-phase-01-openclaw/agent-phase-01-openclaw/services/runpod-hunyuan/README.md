# sophia-runpod-hunyuan

Runpod serverless handler for HunyuanVideo 1.5 (Path B — Cinematic).

## Runpod Template Setup

1. **GPU:** NVIDIA A100 80GB (spot pricing: ~$0.30-1.00/min)
2. **Base image:** `runpod/pytorch:2.2.0-py3.11-cuda12.1.1-devel-ubuntu22.04`
3. **Container start command:** `python handler.py`
4. **Endpoint type:** Serverless

### Model Download Script (run once during image build)

```bash
pip install runpod boto3 torch torchvision
# Install HunyuanVideo
git clone https://github.com/Tencent/HunyuanVideo /app/hunyuan
cd /app/hunyuan && pip install -r requirements.txt
# Download FP8 weights
huggingface-cli download tencent/HunyuanVideo \
  --local-dir /models/hunyuanvideo \
  --include "*.safetensors" "*.json" "*.txt"
```

### Environment Variables

| Var | Description |
|-----|-------------|
| `R2_ENDPOINT` | Cloudflare R2 endpoint (`https://<account-id>.r2.cloudflarestorage.com`) |
| `R2_ACCESS_KEY_ID` | R2 access key |
| `R2_SECRET_ACCESS_KEY` | R2 secret key |
| `R2_BUCKET` | Bucket name (`sophia-videos`) |
| `MODEL_PATH` | HunyuanVideo model directory (`/models/hunyuanvideo`) |

## Input Schema

```json
{
  "input": {
    "prompts": ["Scene 1 description", "Scene 2 description"],
    "duration": 30,
    "fps": 30
  }
}
```

## Output Schema

```json
{
  "r2_key": "runpod/{jobId}/visual.mp4",
  "download_url": "https://... (presigned, 1h TTL)"
}
```

## Cost Estimate

- A100 80GB spot: ~$0.30-1.00/min
- 30s video at 30fps: ~3-5 min generation = ~$1-5
- 60s video: ~6-10 min = ~$2-10
