---
description: 🚀 Deploy model to serving endpoint (REST/gRPC)
argument-hint: [model_path] [platform] [config]
---

**Think** để deploy model với production-ready serving: <action>deploy $ARGUMENTS</action>

## 🌐 Model Deployment Context

Project: `apps/analytics/`
Tech: `FastAPI · TorchServe · Triton · Kubernetes · Cloud Run`

## Quick Command Map

| Task | Command |
|------|---------|
| Deploy local dev | `/model-deploy models/best.pth local` |
| Deploy to Cloud Run | `/model-deploy models/best.pth cloud-run --project gcp` |
| Deploy with Triton | `/model-deploy models/best.pth triton --gpu` |
| A/B test deploy | `/model-deploy models/v1.pth v2.pth --ab-test 90/10` |
| Canary rollout | `/model-deploy models/new.pth --canary 10%` |
| Health check | `/model-deploy status endpoint-name` |

## Workflow

### 1. Parse Arguments
```
- model_path: Path to model or model registry ID
- platform: Target platform (local/cloud-run/triton/k8s)
- config: Deployment config override
- --gpu: Enable GPU acceleration
- --replicas: Number of replicas (default: 1)
- --canary: Canary rollout percentage
- --ab-test: A/B test with traffic split
```

### 2. Route to Operation
```
├── Local         → serve_local()
├── Cloud Run     → deploy_gcp()
├── Triton        → deploy_triton()
├── Kubernetes    → deploy_k8s()
└── A/B Test      → setup_ab_test()
```

### 3. Execute Deployment
```python
# Deployment pipeline
1. Validate model → check format + dependencies
2. Build container → Docker image with model
3. Configure serving → batch size, timeout, scaling
4. Deploy to platform → push + apply config
5. Health check → wait for ready
6. Smoke test → send test request
```

## Deployment Platforms

### Local Development
```bash
# FastAPI dev server
python -m uvicorn inference:app --reload --port 8000
```

### Google Cloud Run
```yaml
# cloud-run.yaml
service: model-serving
cpu: 2
memory: 4Gi
timeout: 60s
max_instances: 10
gpu: false
```

### NVIDIA Triton
```yaml
# triton-config.yaml
instance_group:
  - count: 1
    kind: KIND_GPU
dynamic_batching:
  preferred_batch_size: [8, 16, 32]
  max_queue_delay_microseconds: 100
```

### Kubernetes
```yaml
# k8s-deployment.yaml
replicas: 3
resources:
  limits:
    nvidia.com/gpu: 1
    memory: 8Gi
autoscaling:
  min: 2
  max: 10
  target_cpu: 70%
```

## API Contract

```python
# Request
POST /v1/predict
{
  "instances": [
    {"data": [0.1, 0.2, 0.3, ...]},
    {"data": [0.4, 0.5, 0.6, ...]}
  ]
}

# Response
{
  "predictions": [
    {"label": "class_1", "score": 0.95},
    {"label": "class_0", "score": 0.87}
  ],
  "latency_ms": 45,
  "model_version": "v1.2.3"
}
```

## Quality Gates

- [ ] Container builds successfully
- [ ] Health check passes
- [ ] Latency < 100ms (p95)
- [ ] Throughput meets target
- [ ] Auto-scaling configured
- [ ] Monitoring enabled
