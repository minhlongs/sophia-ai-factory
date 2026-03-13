---
description: ⚗️ Hyperparameter optimization (Grid/Bayesian)
argument-hint: [model] [dataset] [search_space]
---

**Think** để optimize hyperparameters với search strategies: <action>tune $ARGUMENTS</action>

## 🔬 Hyperparameter Tuning Context

Project: `apps/analytics/`
Tech: `Optuna · Ray Tune · WandB Sweeps · ASHA`

## Quick Command Map

| Task | Command |
|------|---------|
| Grid search | `/hyperparam-tune resnet50 cifar10 --strategy grid` |
| Bayesian opt | `/hyperparam-tune vit imagenet --strategy bayesian --trials 50` |
| Random search | `/hyperparam-tune bert squad --strategy random --trials 20` |
| Multi-fidelity | `/hyperparam-tune llm custom --strategy asha --budget 100` |
| Resume tuning | `/hyperparam-tune resume study_id_123` |
| Best trials | `/hyperparam-tune best study_id_123 --top-k 5` |

## Workflow

### 1. Parse Arguments
```
- model: Model architecture to tune
- dataset: Training dataset
- search_space: Hyperparameter ranges (YAML)
- --strategy: grid/bayesian/random/asha
- --trials: Number of trials (default: 20)
- --budget: Total training budget (for ASHA)
- --pruner: Early stopping pruner type
- --parallel: Number of parallel trials
```

### 2. Route to Operation
```
├── Grid        → grid_search()
├── Bayesian    → bayesian_optimization()
├── Random      → random_search()
├── ASHA        → asynchronous_sh()
├── Resume      → resume_study()
└── Best        → get_best_trials()
```

### 3. Execute Tuning
```python
# Tuning workflow
1. Define search space → parameter ranges
2. Create study → Optuna/Ray study object
3. Run trials → sample params + train + evaluate
4. Prune bad trials → early stopping
5. Track results → metrics + params per trial
6. Select best → top-k configurations
```

## Search Strategies

### Grid Search (Exhaustive)
```yaml
search_space:
  learning_rate: [0.001, 0.01, 0.1]
  batch_size: [16, 32, 64]
  weight_decay: [0.0001, 0.001, 0.01]
# Total: 3 × 3 × 3 = 27 trials
```

### Bayesian Optimization (Smart)
```yaml
search_space:
  learning_rate:
    type: log_uniform
    low: 1e-5
    high: 1e-1
  batch_size:
    type: categorical
    choices: [16, 32, 64, 128]
  num_layers:
    type: int_uniform
    low: 4
    high: 24
# Uses TPE sampler for efficient exploration
```

### ASHA (Multi-fidelity)
```yaml
# Promising trials continue, others pruned
strategy: asha
max_epochs: 100
reduction_factor: 3
min_epochs: 3
# Trials pruned if not competitive
```

## Search Space Templates

### CNN Tuning
```yaml
learning_rate:
  type: log_uniform
  low: 1e-4
  high: 1e-2
optimizer:
  type: categorical
  choices: [adam, adamw, sgd]
batch_size:
  type: categorical
  choices: [32, 64, 128]
weight_decay:
  type: log_uniform
  low: 1e-5
  high: 1e-3
dropout:
  type: uniform
  low: 0.1
  high: 0.5
```

### Transformer Tuning
```yaml
learning_rate:
  type: log_uniform
  low: 1e-5
  high: 5e-4
warmup_steps:
  type: int_uniform
  low: 100
  high: 1000
num_heads:
  type: categorical
  choices: [4, 8, 12, 16]
hidden_dim:
  type: categorical
  choices: [256, 512, 768, 1024]
label_smoothing:
  type: uniform
  low: 0.0
  high: 0.1
```

## Results Dashboard

```
Study: resnet50-cifar10-tuning
Trials: 50 complete | 3 pruned
Best value: 0.9234 (trial #37)

Top 5 Trials:
┌───────┬────────────┬──────────┬────────────┐
│ Trial │ Validation │ LR       │ Batch Size │
├───────┼────────────┼──────────┼────────────┤
│ 37    │ 0.9234     │ 0.0032   │ 64         │
│ 42    │ 0.9221     │ 0.0028   │ 64         │
│ 29    │ 0.9198     │ 0.0041   │ 32         │
│ 15    │ 0.9187     │ 0.0035   │ 128        │
│ 48    │ 0.9175     │ 0.0029   │ 64         │
└───────┴────────────┴──────────┴────────────┘
```

## Output Artifacts

```
tuning/
├── study_123/
│   ├── study.pkl          # Optuna study object
│   ├── trials.json        # All trial results
│   ├── best_params.yaml   # Best configuration
│   └── plots/
│       ├── optimization.png
│       ├── parallel_coord.png
│       └── contour.png
```

## Quality Gates

- [ ] Search space covers reasonable ranges
- [ ] Enough trials for convergence
- [ ] Early stopping configured
- [ ] Results reproducible (seed)
- [ ] Best params validated
