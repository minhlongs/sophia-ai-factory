---
description: 🤖 Train ML model với config và tracking
argument-hint: [model_name] [dataset] [config]
---

**Think** để train model ML với tracking đầy đủ: <action>train $ARGUMENTS</action>

## 🎯 Model Training Context

Project: `apps/analytics/`
Tech: `Python · PyTorch · MLflow · Weights & Biases`

## Quick Command Map

| Task | Command |
|------|---------|
| Train với config default | `/model-train resnet50 cifar10` |
| Train với custom config | `/model-train vit imagenet --config configs/vit.yaml` |
| Resume training | `/model-train bert squad --resume checkpoints/last.ckpt` |
| Distributed training | `/model-train llm custom --gpus 4 --strategy ddp` |
| Dry run (test config) | `/model-train test dummy --dry-run` |

## Workflow

### 1. Parse Arguments
```
- model_name: Architecture (resnet50, vit, bert, custom)
- dataset: Dataset identifier (cifar10, imagenet, custom_path)
- config: Optional YAML config override
- --resume: Resume from checkpoint
- --gpus: Number of GPUs (default: 1)
- --strategy: Distributed strategy (ddp, deepspeed)
- --dry-run: Validate config without training
```

### 2. Route to Operation
```
├── Single GPU → train_single()
├── Multi GPU  → train_ddp()
├── Resume     → train_resume()
└── Dry run    → validate_config()
```

### 3. Execute Training
```python
# Training pipeline with tracking
1. Load config → merge defaults + overrides
2. Initialize model → from model registry
3. Load dataset → apply transforms
4. Setup tracking → MLflow + W&B
5. Train loop → with checkpointing
6. Save artifacts → model + metrics
```

## Configuration Template

```yaml
# configs/default.yaml
model:
  name: resnet50
  pretrained: true
  num_classes: 10

training:
  batch_size: 32
  epochs: 100
  lr: 0.001
  optimizer: adamw
  scheduler: cosine

tracking:
  mlflow_uri: http://localhost:5000
  wandb_project: analytics-models
```

## Output Artifacts

```
models/
├── checkpoints/
│   ├── epoch_050.pth
│   ├── epoch_100.pth
│   └── best.pth
├── mlruns/           # MLflow tracking
└── wandb/            # W&B logs
```

## Quality Gates

- [ ] Training loss decreases
- [ ] Validation accuracy improves
- [ ] No NaN/Inf in weights
- [ ] Checkpoint saved successfully
- [ ] Metrics logged to MLflow
