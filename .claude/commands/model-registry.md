---
description: 📦 Manage model versions và lifecycle
argument-hint: [operation] [model_name] [version]
---

**Think** để quản lý model versions với registry: <action>registry $ARGUMENTS</action>

## 🗄️ Model Registry Context

Project: `apps/analytics/`
Tech: `MLflow · S3/GCS · Model Cards · Version Control`

## Quick Command Map

| Task | Command |
|------|---------|
| List models | `/model-registry list` |
| Register model | `/model-registry register resnet50 models/best.pth` |
| Get version | `/model-registry get resnet50 v1.2.0` |
| Compare versions | `/model-registry compare resnet50 v1.0 v2.0` |
| Promote model | `/model-registry promote resnet50 v1.2.0 production` |
| Archive model | `/model-registry archive resnet50 v0.9.0` |
| Delete version | `/model-registry delete resnet50 v0.5.0` |

## Workflow

### 1. Parse Arguments
```
- operation: list/register/get/compare/promote/archive/delete
- model_name: Model identifier
- version: Semantic version (v1.2.3)
- --stage: Model stage (dev/staging/production/archived)
- --metadata: Additional metadata JSON
- --force: Force operation (for delete)
```

### 2. Route to Operation
```
├── list        → list_models()
├── register    → register_model()
├── get         → get_version()
├── compare     → compare_versions()
├── promote     → promote_stage()
├── archive     → archive_version()
└── delete      → delete_version()
```

### 3. Execute Registry Operation
```python
# Registry workflow
1. Validate input → check model exists + version format
2. Load metadata → metrics, params, artifacts
3. Store artifacts → upload to S3/GCS
4. Update registry → MLflow + metadata DB
5. Tag version → stage labels + checksums
```

## Model Stages

```
┌─────────────────────────────────────────┐
│  development → staging → production     │
│       ↓           ↓           ↓         │
│    WIP       Testing       Live         │
└─────────────────────────────────────────┘
        ↓
    archived (deprecated versions)
```

## Version Metadata

```yaml
model: resnet50
version: v1.2.3
stage: production

# Training provenance
trained_at: 2026-03-01T10:30:00Z
dataset: imagenet-v4
commit: abc123f

# Performance
metrics:
  accuracy: 0.923
  val_loss: 0.234

# Artifacts
files:
  - model.pth (256MB)
  - config.yaml
  - preprocessor.pkl

# Dependencies
python: "3.11"
pytorch: "2.1.0"
cuda: "12.1"
```

## Model Card Template

```markdown
# Model Card: resnet50

## Intended Use
- Image classification on natural images
- 1000-class ImageNet categories

## Training Data
- Dataset: ImageNet-1k (1.28M images)
- Augmentation: RandomCrop, Flip, ColorJitter

## Performance
| Metric | Value |
|--------|-------|
| Top-1 Accuracy | 76.1% |
| Top-5 Accuracy | 92.8% |
| Inference Time | 15ms |

## Limitations
- Performance degrades on non-natural images
- Biased towards common objects
```

## Storage Structure

```
models/
├── registry.json           # Registry index
├── resnet50/
│   ├── v1.0.0/
│   │   ├── model.pth
│   │   ├── config.yaml
│   │   └── metadata.json
│   ├── v1.1.0/
│   └── v1.2.0/
└── vit/
    └── v2.0.0/
```

## Quality Gates

- [ ] Version follows semver
- [ ] Metrics recorded
- [ ] Artifacts checksummed
- [ ] Model card included
- [ ] Dependencies documented
