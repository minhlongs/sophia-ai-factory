---
description: 🧪 Experiment Tracking — ML Experiment Management with MLflow/W&B
argument-hint: [experiment] [action] [options]
---

**Think** để track experiments với MLflow/Weights & Biases: <action>experiment $ARGUMENTS</action>

## 🧪 Experiment Tracking Context

Project: `apps/analytics/`
Tech: `MLflow · Weights & Biases · Neptune · TensorBoard · Comet ML`

## Quick Command Map

| Task | Command |
|------|---------|
| Create experiment | `/experiment-tracking create churn-v2 --base-model resnet50` |
| Log run | `/experiment-tracking log churn-v2 --metrics accuracy:0.92 --params lr:0.001` |
| Compare runs | `/experiment-tracking compare run1,run2,run3 --metrics accuracy,loss` |
| Search runs | `/experiment-tracking search --filter "accuracy > 0.90" --order accuracy DESC` |
| Register model | `/experiment-tracking register run-abc123 --name churn-model --stage staging` |
| Visualize | `/experiment-tracking viz churn-v2 --port 5000` |

## Workflow

### 1. Parse Arguments
```
- experiment: Experiment name
- action: create/log/compare/search/register/viz
- --metrics: Metrics to log (key:value pairs)
- --params: Parameters to log (key:value pairs)
- --artifacts: Artifact paths to log
- --filter: Search filter expression
- --order: Sort order for search results
- --stage: Model registry stage (staging/production/archived)
```

### 2. Route to Operation
```
├── Create      → create_experiment()
├── Log         → log_run()
├── Compare     → compare_runs()
├── Search      → search_runs()
├── Register    → register_model()
└── Visualize   → start_ui()
```

### 3. Execute Tracking
```python
# Experiment tracking workflow
1. Connect to tracking server
2. Create/get experiment
3. Start run
4. Log parameters, metrics, artifacts
5. End run
6. Register model (optional)
```

## MLflow Setup

### Configuration
```python
import mlflow

# Configure tracking server
mlflow.set_tracking_uri("http://localhost:5000")

# Set experiment
mlflow.set_experiment("churn-prediction-v2")

# Or create experiment
experiment_id = mlflow.create_experiment(
    name="churn-prediction-v2",
    artifact_location="s3://mlflow-artifacts/churn-v2",
    tags={"team": "ml-team", "project": "churn"},
)
```

### Project Structure
```
mlruns/
├── 0/                          # Default experiment
├── 1/                          # churn-prediction-v2
│   ├── meta.yaml
│   ├── runs/
│   │   ├── abc123.../
│   │   │   ├── meta.yaml
│   │   │   ├── metrics/
│   │   │   ├── params/
│   │   │   └── artifacts/
│   │   └── def456.../
│   └── models/
│       └── churn-model/
│           ├── meta.yaml
│           └── versions/
└── models/
    └── churn-model/
```

## Logging Experiments

### Basic Logging
```python
import mlflow

with mlflow.start_run(run_name="baseline-resnet50"):
    # Log parameters
    mlflow.log_param("learning_rate", 0.001)
    mlflow.log_param("batch_size", 32)
    mlflow.log_param("epochs", 100)
    mlflow.log_param("optimizer", "adam")
    mlflow.log_param("model_architecture", "resnet50")

    # Log metrics
    mlflow.log_metric("accuracy", 0.9234)
    mlflow.log_metric("precision", 0.9156)
    mlflow.log_metric("recall", 0.8978)
    mlflow.log_metric("f1_score", 0.9066)
    mlflow.log_metric("loss", 0.2341)

    # Log artifacts
    mlflow.log_artifact("model.pth", "models")
    mlflow.log_artifact("confusion_matrix.png", "plots")
    mlflow.log_artifact("predictions.csv", "predictions")

    # Log model
    mlflow.pytorch.log_model(
        pytorch_model=model,
        artifact_path="model",
        conda_env="./conda.yaml",
        registered_model_name="churn-model",
    )
```

### Nested Runs
```python
# Parent run for hyperparameter sweep
with mlflow.start_run(run_name="hp-sweep") as parent_run:
    mlflow.log_param("sweep_type", "bayesian")
    mlflow.log_param("num_trials", 50)

    # Child runs for each trial
    for trial in trials:
        with mlflow.start_run(
            run_name=f"trial-{trial.id}",
            nested=True,
        ) as child_run:
            mlflow.log_param("trial_id", trial.id)
            mlflow.log_param("lr", trial.lr)
            mlflow.log_param("batch_size", trial.batch_size)

            # Train and log metrics
            accuracy = train_and_evaluate(trial)
            mlflow.log_metric("accuracy", accuracy)
```

### Autologging
```python
import mlflow
import tensorflow as tf

# Enable autologging for TensorFlow
mlflow.tensorflow.autolog()

# Train model - metrics logged automatically
model.fit(X_train, y_train, epochs=10, validation_data=(X_val, y_val))

# Autologging for PyTorch Lightning
mlflow.pytorch.autolog()

trainer = pl.Trainer(max_epochs=10)
trainer.fit(model, train_dataloader, val_dataloader)

# Autologging for scikit-learn
mlflow.sklearn.autolog()

from sklearn.ensemble import RandomForestClassifier
clf = RandomForestClassifier(n_estimators=100)
clf.fit(X_train, y_train)
```

## Weights & Biases Integration

### W&B Setup
```python
import wandb

# Initialize
wandb.init(
    project="churn-prediction",
    config={
        "learning_rate": 0.001,
        "batch_size": 32,
        "epochs": 100,
        "optimizer": "adam",
        "model": "resnet50",
    },
    tags=["churn", "v2", "baseline"],
    notes="Baseline model with ResNet50 architecture",
)

# Log metrics
wandb.log({
    "accuracy": 0.9234,
    "precision": 0.9156,
    "recall": 0.8978,
    "f1_score": 0.9066,
    "epoch": epoch,
})

# Log artifacts
wandb.save("model.pth")
wandb.save("predictions.csv")

# Log table
wandb.log({
    "predictions": wandb.Table(
        columns=["image", "prediction", "actual", "confidence"],
        data=[
            (img, pred, actual, conf)
            for img, pred, actual, conf in sample_predictions
        ],
    )
})

# Log media
wandb.log({
    "confusion_matrix": wandb.plot.confusion_matrix(
        probs=predicted_probs,
        y_true=actual_labels,
        class_names=["churn", "no_churn"],
    ),
    "roc_curve": wandb.plot.roc_curve(actual_labels, predicted_probs),
})

wandb.finish()
```

## Compare Runs

### MLflow Compare
```python
import mlflow
import pandas as pd

# Search runs
runs = mlflow.search_runs(
    experiment_names=["churn-prediction-v2"],
    filter_string="metrics.accuracy > 0.90",
    order_by=["metrics.accuracy DESC"],
    max_results=10,
)

# Display comparison
print(runs[["run_id", "params.learning_rate", "params.batch_size", "metrics.accuracy"]])

# Compare specific runs
from mlflow.tracking import MlflowClient

client = MlflowClient()
run_ids = ["abc123", "def456", "ghi789"]

runs_data = []
for run_id in run_ids:
    run = client.get_run(run_id)
    runs_data.append({
        "run_id": run_id,
        "learning_rate": run.data.params.get("learning_rate"),
        "batch_size": run.data.params.get("batch_size"),
        "accuracy": run.data.metrics.get("accuracy"),
        "f1_score": run.data.metrics.get("f1_score"),
    })

comparison_df = pd.DataFrame(runs_data)
print(comparison_df)
```

### W&B Compare
```python
import wandb
import pandas as pd

# Initialize API
api = wandb.Api()

# Get runs
runs = api.runs(
    "username/churn-prediction",
    filters={"config.learning_rate": {"$gt": 0.0005}},
    order="-summary_metrics.accuracy",
    per_page=10,
)

# Create comparison table
data = []
for run in runs:
    data.append({
        "run_id": run.id,
        "name": run.name,
        "learning_rate": run.config.get("learning_rate"),
        "batch_size": run.config.get("batch_size"),
        "accuracy": run.summary.get("accuracy"),
        "f1_score": run.summary.get("f1_score"),
        "duration": run.duration_seconds,
    })

df = pd.DataFrame(data)
print(df)
```

## Model Registry

### Register Model
```python
import mlflow

# Register model from run
model_uri = "runs:/abc123def456/model"
model_name = "churn-model"

# Register
registered_model = mlflow.register_model(
    model_uri=model_uri,
    name=model_name,
)

print(f"Registered model: {registered_model.name}, version: {registered_model.version}")
```

### Model Versioning
```python
from mlflow.tracking import MlflowClient

client = MlflowClient()

# Transition model stage
client.transition_model_version_stage(
    name="churn-model",
    version=3,
    stage="Staging",
)

# Archive old version
client.transition_model_version_stage(
    name="churn-model",
    version=2,
    stage="Archived",
)

# Get model version
model_version = client.get_model_version(
    name="churn-model",
    version="3",
)

print(model_version)
```

### Load Model from Registry
```python
import mlflow.pytorch

# Load latest staging model
model = mlflow.pytorch.load_model(
    model_uri="models:/churn-model/Staging",
)

# Load specific version
model = mlflow.pytorch.load_model(
    model_uri="models:/churn-model/3",
)

# Load production model
model = mlflow.pytorch.load_model(
    model_uri="models:/churn-model/Production",
)
```

## Experiment Visualization

### Start MLflow UI
```bash
# Local UI
mlflow ui --port 5000

# With backend store
mlflow ui --backend-store-uri sqlite:///mlflow.db --port 5000

# Remote server
mlflow server \
  --host 0.0.0.0 \
  --port 5000 \
  --backend-store-uri s3://mlflow-tracking \
  --default-artifact-root s3://mlflow-artifacts
```

### Custom Dashboard
```python
import plotly.graph_objects as go
import plotly.express as px
import mlflow

def create_experiment_dashboard(experiment_name: str):
    """Create interactive dashboard for experiment."""
    runs = mlflow.search_runs(
        experiment_names=[experiment_name],
        order_by=["start_time DESC"],
    )

    # Learning rate vs accuracy scatter
    fig_lr = px.scatter(
        runs,
        x="params.learning_rate",
        y="metrics.accuracy",
        color="metrics.f1_score",
        hover_data=["run_id", "params.batch_size"],
        title="Learning Rate vs Accuracy",
        log_x=True,
    )

    # Training metrics over time
    fig_time = px.line(
        runs.sort_values("start_time"),
        x="start_time",
        y="metrics.accuracy",
        title="Accuracy Over Time",
    )

    # Parameter parallel coordinates
    fig_parallel = px.parallel_coordinates(
        runs,
        dimensions=["params.learning_rate", "params.batch_size"],
        color="metrics.accuracy",
        title="Hyperparameter Impact on Accuracy",
    )

    return fig_lr, fig_time, fig_parallel
```

## Output Artifacts

```
experiments/
├── mlruns/
│   ├── 0/
│   └── 1/
├── configs/
│   ├── experiment_config.yaml
│   └── model_configs/
│       └── resnet50.yaml
├── notebooks/
│   ├── experiment_analysis.ipynb
│   └── model_comparison.ipynb
└── reports/
    ├── experiment_summary.pdf
    └── best_runs.json
```

## Quality Gates

- [ ] All runs have parameters logged
- [ ] All runs have metrics logged
- [ ] Artifacts saved for each run
- [ ] Models registered with versioning
- [ ] Experiment metadata documented
