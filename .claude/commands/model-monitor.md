---
description: 📊 Model Monitor — Production Monitoring, Drift Detection, Alerts
argument-hint: [model_name] [metric] [options]
---

**Think** để monitor model production với drift detection: <action>monitor $ARGUMENTS</action>

## 📈 Model Monitoring Context

Project: `apps/analytics/`
Tech: `Evidently AI · Arize · WhyLabs · Prometheus · Grafana · MLflow`

## Quick Command Map

| Task | Command |
|------|---------|
| Setup monitoring | `/model-monitor churn-model setup --metrics accuracy,drift` |
| Check data drift | `/model-monitor churn-model drift --reference baseline.parquet` |
| Check predictions | `/model-monitor churn-model predictions --window 24h` |
| Performance report | `/model-monitor churn-model report --output report.pdf` |
| Setup alerts | `/model-monitor churn-model alert --metric accuracy --threshold 0.85` |
| Dashboard | `/model-monitor churn-monitor dashboard --port 8080` |

## Workflow

### 1. Parse Arguments
```
- model_name: Model to monitor
- metric: Metrics to track (accuracy/drift/latency/throughput)
- --reference: Reference dataset for drift comparison
- --window: Time window for analysis (1h/24h/7d)
- --threshold: Alert threshold
- --output: Report output path
- --dashboard: Start monitoring dashboard
```

### 2. Route to Operation
```
├── Setup       → setup_monitoring()
├── Drift       → detect_data_drift()
├── Predictions → monitor_predictions()
├── Report      → generate_report()
├── Alert       → configure_alerts()
└── Dashboard   → start_dashboard()
```

### 3. Execute Monitoring
```python
# Model monitoring workflow
1. Load model metadata
2. Connect to prediction log
3. Compute metrics (accuracy/drift/latency)
4. Compare against baseline
5. Trigger alerts if threshold breached
6. Update dashboard
```

## Monitoring Dashboard

### Metrics to Track
```python
MONITORING_METRICS = {
    # Prediction Metrics
    "prediction_count": "Total predictions per time window",
    "prediction_latency_p50": "Median inference latency",
    "prediction_latency_p99": "Tail latency (99th percentile)",
    "throughput": "Predictions per second",

    # Accuracy Metrics (when ground truth available)
    "accuracy": "Prediction accuracy",
    "precision": "Precision score",
    "recall": "Recall score",
    "f1_score": "F1 score",
    "roc_auc": "ROC AUC score",

    # Data Drift Metrics
    "psi": "Population Stability Index",
    "kl_divergence": "Kullback-Leibler divergence",
    "wasserstein_distance": "Earth Mover's distance",
    "chi_square": "Chi-square test statistic",

    # Feature Health
    "null_rate": "Percentage of null values",
    "out_of_range": "Percentage of out-of-range values",
    "cardinality": "Number of unique values",
}
```

## Data Drift Detection

### Evidently AI Integration
```python
from evidently.report import Report
from evidently.metrics import DataDriftTable, DataDriftPlot
from evidently.column_mapping import ColumnMapping
import pandas as pd

def detect_data_drift(
    reference_data: pd.DataFrame,
    current_data: pd.DataFrame,
    model_features: list,
) -> Report:
    """
    Detect data drift between reference and current datasets.
    """
    column_mapping = ColumnMapping(
        target=None,
        prediction=None,
        numerical_features=model_features,
        categorical_features=model_features,
    )

    report = Report(
        metrics=[
            DataDriftTable(),
            DataDriftPlot(),
        ],
        column_mapping=column_mapping,
    )

    report.run(
        reference_data=reference_data,
        current_data=current_data,
    )

    return report

# Save HTML report
report.save_html("drift_report.html")
```

### PSI Calculation
```python
import numpy as np

def calculate_psi(
    reference: np.ndarray,
    current: np.ndarray,
    buckets: int = 10,
) -> float:
    """
    Calculate Population Stability Index (PSI).

    PSI < 0.1: No significant drift
    0.1 <= PSI < 0.2: Moderate drift
    PSI >= 0.2: Significant drift
    """
    # Create buckets
    breakpoints = np.linspace(
        min(reference.min(), current.min()),
        max(reference.max(), current.max()),
        buckets + 1,
    )

    # Calculate distributions
    ref_dist = np.histogram(reference, bins=breakpoints)[0] / len(reference)
    curr_dist = np.histogram(current, bins=breakpoints)[0] / len(current)

    # Avoid division by zero
    ref_dist = np.where(ref_dist == 0, 0.0001, ref_dist)
    curr_dist = np.where(curr_dist == 0, 0.0001, curr_dist)

    # Calculate PSI
    psi = np.sum((curr_dist - ref_dist) * np.log(curr_dist / ref_dist))

    return psi
```

## Prediction Monitoring

### Log Predictions
```python
import json
from datetime import datetime

def log_prediction(
    model_name: str,
    features: dict,
    prediction: float,
    confidence: float,
    latency_ms: float,
) -> None:
    """Log prediction for monitoring."""
    log_entry = {
        "timestamp": datetime.utcnow().isoformat(),
        "model_name": model_name,
        "features": features,
        "prediction": prediction,
        "confidence": confidence,
        "latency_ms": latency_ms,
    }

    # Write to prediction log (file/Kafka/BigQuery)
    with open(f"predictions/{model_name}.jsonl", "a") as f:
        f.write(json.dumps(log_entry) + "\n")
```

### Monitor Prediction Distribution
```python
def monitor_predictions(
    model_name: str,
    window_hours: int = 24,
) -> dict:
    """Monitor prediction distribution over time."""
    from datetime import datetime, timedelta

    cutoff = datetime.utcnow() - timedelta(hours=window_hours)

    predictions = []
    with open(f"predictions/{model_name}.jsonl") as f:
        for line in f:
            entry = json.loads(line)
            if datetime.fromisoformat(entry["timestamp"]) > cutoff:
                predictions.append(entry["prediction"])

    return {
        "count": len(predictions),
        "mean": np.mean(predictions),
        "std": np.std(predictions),
        "min": np.min(predictions),
        "max": np.max(predictions),
        "percentiles": {
            "p50": np.percentile(predictions, 50),
            "p90": np.percentile(predictions, 90),
            "p99": np.percentile(predictions, 99),
        },
    }
```

## Alert Configuration

### Prometheus Alerts
```yaml
# prometheus/alerts.yml
groups:
  - name: model_alerts
    rules:
      - alert: ModelAccuracyDropped
        expr: model_accuracy < 0.85
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "Model accuracy dropped below 85%"
          description: "Model {{ $labels.model_name }} accuracy is {{ $value }}%"

      - alert: DataDriftDetected
        expr: data_drift_psi > 0.2
        for: 10m
        labels:
          severity: warning
        annotations:
          summary: "Data drift detected for {{ $labels.model_name }}"
          description: "PSI: {{ $value }}"

      - alert: HighPredictionLatency
        expr: prediction_latency_p99 > 500
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "High prediction latency"
          description: "P99 latency is {{ $value }}ms"
```

### Slack Alerts
```python
from slack_sdk import WebClient

def send_alert(
    metric_name: str,
    model_name: str,
    value: float,
    threshold: float,
    severity: str = "warning",
) -> None:
    """Send alert to Slack channel."""
    client = WebClient(token=os.environ["SLACK_BOT_TOKEN"])

    color = {"critical": "danger", "warning": "warning", "info": "good"}[severity]

    client.chat_postMessage(
        channel="#ml-alerts",
        blocks=[
            {
                "type": "section",
                "text": {
                    "type": "mrkdwn",
                    "text": f":{severity}: *Model Alert: {metric_name}*",
                },
            },
            {
                "type": "section",
                "fields": [
                    {"type": "mrkdwn", "text": f"*Model:*\n{model_name}"},
                    {"type": "mrkdwn", "text": f"*Metric:*\n{metric_name}"},
                    {"type": "mrkdwn", "text": f"*Value:*\n{value:.4f}"},
                    {"type": "mrkdwn", "text": f"*Threshold:*\n{threshold:.4f}"},
                ],
            },
        ],
    )
```

## Performance Report

### Generate PDF Report
```python
from reportlab.lib.pagesizes import letter
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Image
from reportlab.lib.styles import getSampleStyleSheet

def generate_report(
    model_name: str,
    metrics: dict,
    drift_analysis: dict,
    output_path: str = "report.pdf",
) -> None:
    """Generate PDF monitoring report."""
    doc = SimpleDocTemplate(output_path, pagesize=letter)
    styles = getSampleStyleSheet()
    story = []

    # Title
    story.append(Paragraph(f"Model Monitoring Report: {model_name}", styles["Title"]))
    story.append(Spacer(1, 12))

    # Date
    story.append(Paragraph(f"Generated: {datetime.now().strftime('%Y-%m-%d %H:%M')}", styles["Normal"]))
    story.append(Spacer(1, 24))

    # Metrics Summary
    story.append(Paragraph("Performance Metrics", styles["Heading2"]))
    for metric_name, value in metrics.items():
        story.append(Paragraph(f"{metric_name}: {value:.4f}", styles["Normal"]))

    # Drift Analysis
    story.append(Paragraph("Drift Analysis", styles["Heading2"]))
    for feature, psi in drift_analysis.items():
        status = "DRIFT" if psi > 0.2 else "STABLE"
        story.append(Paragraph(f"{feature}: PSI={psi:.4f} [{status}]", styles["Normal"]))

    doc.build(story)
```

## Monitoring Dashboard (Grafana)

### Dashboard JSON
```json
{
  "dashboard": {
    "title": "Model Monitoring - churn-model",
    "panels": [
      {
        "title": "Prediction Count",
        "type": "graph",
        "targets": [
          {
            "expr": "rate(predictions_total{model='churn-model'}[5m])",
            "legendFormat": "Predictions/sec"
          }
        ]
      },
      {
        "title": "Prediction Latency",
        "type": "graph",
        "targets": [
          {
            "expr": "histogram_quantile(0.99, rate(prediction_latency_bucket[5m]))",
            "legendFormat": "P99 Latency"
          },
          {
            "expr": "histogram_quantile(0.50, rate(prediction_latency_bucket[5m]))",
            "legendFormat": "P50 Latency"
          }
        ]
      },
      {
        "title": "Model Accuracy",
        "type": "stat",
        "targets": [
          {
            "expr": "model_accuracy{model='churn-model'}",
            "legendFormat": "Accuracy"
          }
        ],
        "thresholds": [
          {"value": 0.85, "color": "red"},
          {"value": 0.90, "color": "yellow"},
          {"value": 0.95, "color": "green"}
        ]
      },
      {
        "title": "Data Drift (PSI)",
        "type": "table",
        "targets": [
          {
            "expr": "data_drift_psi{model='churn-model'}",
            "legendFormat": "{{feature}}"
          }
        ]
      }
    ]
  }
}
```

## Output Artifacts

```
monitoring/
├── models/
│   ├── churn-model/
│   │   ├── config.yaml          # Monitoring config
│   │   ├── baseline.parquet     # Reference dataset
│   │   └── alerts.yaml          # Alert thresholds
│   └── ltv-model/
├── predictions/
│   ├── churn-model.jsonl        # Prediction logs
│   └── ltv-model.jsonl
├── reports/
│   ├── daily/
│   └── weekly/
└── dashboards/
    ├── grafana-churn.json
    └── grafana-ltv.json
```

## Quality Gates

- [ ] Baseline dataset defined
- [ ] Drift thresholds configured
- [ ] Alerts set up for critical metrics
- [ ] Dashboard deployed
- [ ] Runbook for incidents documented
