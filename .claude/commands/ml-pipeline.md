---
description: 🔗 Build ML workflow (pipeline orchestration)
argument-hint: [pipeline_name] [steps] [scheduler]
---

**Think** để build ML pipeline với orchestration: <action>pipeline $ARGUMENTS</action>

## 🔗 ML Pipeline Context

Project: `apps/analytics/`
Tech: `Prefect · Airflow · MLflow · Kedro · Kubeflow`

## Quick Command Map

| Task | Command |
|------|---------|
| Create pipeline | `/ml-pipeline train-pipeline --steps data,train,eval` |
| Run pipeline | `/ml-pipeline run train-pipeline` |
| Schedule pipeline | `/ml-pipeline schedule train-pipeline --cron "0 2 * * *"` |
| View DAG | `/ml-pipeline visualize train-pipeline` |
| Backfill | `/ml-pipeline backfill train-pipeline --start 2026-01-01` |
| Compare runs | `/ml-pipeline compare train-pipeline run1 run2` |

## Workflow

### 1. Parse Arguments
```
- pipeline_name: Pipeline identifier
- steps: Comma-separated step names
- scheduler: cron expression or event trigger
- --config: Pipeline config file
- --backfill: Historical backfill date range
- --dry-run: Validate pipeline without execution
```

### 2. Route to Operation
```
├── Create      → create_pipeline()
├── Run         → execute_pipeline()
├── Schedule    → create_schedule()
├── Visualize   → generate_dag()
├── Backfill    → backfill_runs()
└── Compare     → compare_runs()
```

### 3. Execute Pipeline
```python
# Pipeline workflow
1. Load config → pipeline definition
2. Validate DAG → check dependencies
3. Initialize state → Prefect/Airflow
4. Execute steps → in order/parallel
5. Track artifacts → MLflow logging
6. Report results → success/failure status
```

## Pipeline DAG Example

```yaml
# pipelines/train-pipeline.yaml
name: train-pipeline
description: End-to-end ML training pipeline

steps:
  - name: validate_data
    task: data.validate
    depends_on: []
    retry: 2

  - name: preprocess
    task: data.preprocess
    depends_on: [validate_data]
    resources:
      memory: 4Gi

  - name: split_data
    task: data.split
    depends_on: [preprocess]

  - name: train_model
    task: model.train
    depends_on: [split_data]
    resources:
      gpu: true
      memory: 8Gi

  - name: evaluate
    task: model.evaluate
    depends_on: [train_model]

  - name: register
    task: model.register
    depends_on: [evaluate]
    condition: "metrics.accuracy > 0.90"
```

## Pipeline Visualization

```
┌─────────────────────────────────────────────────────────┐
│  train-pipeline DAG                                     │
├─────────────────────────────────────────────────────────┤
│                                                         │
│   ┌──────────────┐                                     │
│   │ validate_data│                                     │
│   └──────┬───────┘                                     │
│          │                                              │
│          ▼                                              │
│   ┌──────────────┐                                     │
│   │  preprocess  │                                     │
│   └──────┬───────┘                                     │
│          │                                              │
│          ▼                                              │
│   ┌──────────────┐                                     │
│   │  split_data  │                                     │
│   └──────┬───────┘                                     │
│          │                                              │
│          ▼                                              │
│   ┌──────────────┐                                     │
│   │  train_model │──(fail)──┐                          │
│   └──────┬───────┘          │                          │
│          │                  │                          │
│          ▼                  │                          │
│   ┌──────────────┐         │                          │
│   │   evaluate   │◄────────┘                          │
│   └──────┬───────┘                                     │
│          │                                              │
│          ▼                                              │
│   ┌──────────────┐                                     │
│   │   register   │                                     │
│   └──────────────┘                                     │
└─────────────────────────────────────────────────────────┘
```

## Scheduling Options

### Cron Schedule
```yaml
schedule:
  type: cron
  expression: "0 2 * * *"  # Daily at 2 AM
  timezone: UTC
```

### Event Trigger
```yaml
schedule:
  type: event
  trigger: new_data_arrived
  source: gcs://bucket/training-data/
```

### Manual Only
```yaml
schedule:
  type: manual  # Run on-demand only
```

## Step Configuration

### Resources
```yaml
resources:
  cpu: 2
  memory: 4Gi
  gpu: 1
  gpu_type: nvidia-tesla-t4
```

### Retry Policy
```yaml
retry:
  max_attempts: 3
  delay: 30s
  backoff: exponential
```

### Notifications
```yaml
notifications:
  on_failure:
    - slack: "#ml-alerts"
    - email: team@example.com
  on_success:
    - slack: "#ml-success"
```

## Run History

```
Pipeline: train-pipeline
┌─────────┬────────────┬─────────┬───────────┬──────────────┐
│ Run ID  │ Started    │ Status  │ Duration  │ Accuracy     │
├─────────┼────────────┼─────────┼───────────┼──────────────┤
│ run_045 │ 03-04 02:00│ Success │ 45m 23s   │ 0.9234       │
│ run_044 │ 03-03 02:00│ Success │ 44m 12s   │ 0.9221       │
│ run_043 │ 03-02 02:00│ Failed  │ 12m 45s   │ -            │
│ run_042 │ 03-01 02:00│ Success │ 46m 01s   │ 0.9198       │
└─────────┴────────────┴─────────┴───────────┴──────────────┘
```

## Output Artifacts

```
pipelines/
├── train-pipeline/
│   ├── pipeline.yaml        # Pipeline definition
│   ├── runs/
│   │   ├── run_045/
│   │   │   ├── logs/
│   │   │   ├── artifacts/
│   │   │   └── metrics.json
│   └── schedules.json
```

## Quality Gates

- [ ] DAG is acyclic
- [ ] All dependencies resolved
- [ ] Resources within limits
- [ ] Error handling configured
- [ ] Artifacts tracked
- [ ] Notifications working
