---
description: 🔌 Setup inference endpoint (REST/gRPC/Streaming)
argument-hint: [model_path] [mode] [config]
---

**Think** để setup inference API với tối ưu latency: <action>inference $ARGUMENTS</action>

## ⚡ Inference API Context

Project: `apps/analytics/`
Tech: `FastAPI · gRPC · vLLM · TensorRT · ONNX Runtime`

## Quick Command Map

| Task | Command |
|------|---------|
| REST API dev | `/inference-api models/best.pth rest --port 8000` |
| gRPC service | `/inference-api models/best.pth grpc --port 50051` |
| Streaming LLM | `/inference-api models/llm.pth stream --backend vllm` |
| Batch inference | `/inference-api models/batch.pth batch --size 32` |
| ONNX export | `/inference-api models/best.pth export-onnx --opset 17` |
| TensorRT opt | `/inference-api models/best.pth tensorrt --precision fp16` |

## Workflow

### 1. Parse Arguments
```
- model_path: Model checkpoint or registry ID
- mode: rest/grpc/stream/batch/export
- config: API config override
- --port: Server port
- --backend: Inference backend (pytorch/vllm/tensorrt/onnx)
- --precision: Model precision (fp32/fp16/int8)
- --batch-size: Max batch size
- --streaming: Enable streaming for LLMs
```

### 2. Route to Operation
```
├── REST        → serve_rest()
├── gRPC        → serve_grpc()
├── Streaming   → serve_streaming()
├── Batch       → serve_batch()
├── Export ONNX → export_onnx()
└── Optimize    → optimize_tensorrt()
```

### 3. Execute Setup
```python
# API setup workflow
1. Load model → checkpoint or registry
2. Optimize → quantization/graph optimization
3. Create service → FastAPI/gRPC service
4. Add endpoints → /predict /health /metrics
5. Configure → batch size, timeout, cors
6. Start server → uvicorn/grpcio
```

## API Endpoints

### REST API (FastAPI)
```python
# POST /v1/predict
@app.post("/v1/predict")
async def predict(request: PredictionRequest):
    """Single prediction"""
    result = await model.predict(request.instances)
    return PredictionResponse(predictions=result)

# POST /v1/predict/batch
@app.post("/v1/predict/batch")
async def predict_batch(request: BatchRequest):
    """Batch prediction"""
    result = await model.batch_predict(request.instances)
    return BatchResponse(predictions=result)

# GET /health
@app.get("/health")
async def health():
    return {"status": "healthy", "model": model.version}

# GET /metrics
@app.get("/metrics")
async def metrics():
    return {
        "requests_total": counter,
        "latency_p50": p50,
        "latency_p99": p99,
    }
```

### gRPC Service
```protobuf
// inference.proto
service InferenceService {
  rpc Predict(PredictRequest) returns (PredictResponse);
  rpc PredictStream(stream PredictRequest) returns (stream PredictResponse);
  rpc Health(HealthRequest) returns (HealthResponse);
}

message PredictRequest {
  repeated Instance instances = 1;
  optional int32 batch_size = 2;
}

message PredictResponse {
  repeated Prediction predictions = 1;
  int32 latency_ms = 2;
}
```

### Streaming (LLMs)
```python
# Server-Sent Events (SSE)
@app.post("/v1/completions")
async def completions(request: CompletionRequest):
    async def generate():
        async for token in model.stream_generate(request.prompt):
            yield f"data: {json.dumps(token)}\n\n"
        yield "data: [DONE]\n\n"

    return StreamingResponse(generate(), media_type="text/event-stream")
```

## Optimization Strategies

### ONNX Export
```python
import torch.onnx

torch.onnx.export(
    model,
    dummy_input,
    "model.onnx",
    opset_version=17,
    input_names=["input"],
    output_names=["output"],
    dynamic_axes={
        "input": {0: "batch_size"},
        "output": {0: "batch_size"}
    }
)
```

### TensorRT Optimization
```python
import tensorrt as trt

# Build optimized engine
builder = trt.Builder(logger)
config = builder.create_builder_config()
config.set_memory_pool_limit(trt.MemoryPoolType.WORKSPACE, 1<<30)
config.set_flag(trt.BuilderFlag.FP16)

engine = builder.build_serialized_network(network, config)
```

### vLLM (LLM Serving)
```python
from vllm import LLM, SamplingParams

llm = LLM(
    model="models/llm.pth",
    tensor_parallel_size=1,
    gpu_memory_utilization=0.9,
    max_num_batched_tokens=4096,
)

outputs = llm.generate(prompts, sampling_params)
```

## Performance Benchmarks

```
Model: resnet50 | Backend: pytorch | Precision: fp32
┌─────────────┬───────────┬────────────┬──────────┐
│ Batch Size  │ Latency   │ Throughput │ GPU Mem  │
├─────────────┼───────────┼────────────┼──────────┤
│ 1           │ 15ms      │ 67 img/s   │ 2.1 GB   │
│ 8           │ 45ms      │ 178 img/s  │ 2.8 GB   │
│ 16          │ 78ms      │ 205 img/s  │ 3.5 GB   │
│ 32          │ 142ms     │ 225 img/s  │ 5.2 GB   │
└─────────────┴───────────┴────────────┴──────────┘

Optimized (TensorRT FP16):
┌─────────────┬───────────┬────────────┬──────────┐
│ 1           │ 8ms       │ 125 img/s  │ 1.8 GB   │
│ 32          │ 85ms      │ 376 img/s  │ 3.1 GB   │
└─────────────┴───────────┴────────────┴──────────┘
```

## Quality Gates

- [ ] p99 latency < 100ms
- [ ] Throughput meets target
- [ ] Memory within limits
- [ ] Error handling complete
- [ ] Metrics exposed
- [ ] CORS configured
