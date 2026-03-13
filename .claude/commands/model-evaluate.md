---
description: 📊 Evaluate model performance với metrics chi tiết
argument-hint: [model_path] [dataset] [metrics]
---

**Think** để evaluate model với metrics toàn diện: <action>evaluate $ARGUMENTS</action>

## 📈 Model Evaluation Context

Project: `apps/analytics/`
Tech: `Python · PyTorch · Scikit-learn · SHAP`

## Quick Command Map

| Task | Command |
|------|---------|
| Evaluate với accuracy | `/model-evaluate models/best.pth val_set` |
| Full metrics report | `/model-evaluate models/best.pth test --all-metrics` |
| Confusion matrix | `/model-evaluate models/best.pth test --confusion` |
| Feature importance | `/model-evaluate models/best.pth test --shap` |
| Compare models | `/model-evaluate compare model1.pth model2.pth` |
| Export report | `/model-evaluate models/best.pth test --export report.json` |

## Workflow

### 1. Parse Arguments
```
- model_path: Path to model checkpoint
- dataset: Evaluation dataset (val/test/custom_path)
- metrics: Specific metrics (accuracy, f1, roc-auc)
- --all-metrics: Compute all available metrics
- --confusion: Generate confusion matrix
- --shap: Compute SHAP values
- --export: Export report to file
```

### 2. Route to Operation
```
├── Single model    → evaluate_single()
├── Compare models  → evaluate_compare()
├── Error analysis  → analyze_errors()
└── Export report   → export_results()
```

### 3. Execute Evaluation
```python
# Evaluation pipeline
1. Load model → from checkpoint
2. Load dataset → test/val split
3. Run inference → collect predictions
4. Compute metrics → per-class + aggregate
5. Generate viz → confusion, ROC, PR curves
6. Export report → JSON + visualizations
```

## Metrics Categories

### Classification
```
- Accuracy, Precision, Recall, F1-Score
- ROC-AUC, PR-AUC
- Confusion Matrix
- Per-class metrics
```

### Regression
```
- MAE, MSE, RMSE
- R² Score
- MAPE
- Residual analysis
```

### Ranking
```
- NDCG, MAP
- Hit Rate, MRR
- Coverage
```

## Output Report

```json
{
  "model": "resnet50",
  "dataset": "test",
  "metrics": {
    "accuracy": 0.923,
    "precision": 0.918,
    "recall": 0.901,
    "f1": 0.909,
    "roc_auc": 0.956
  },
  "per_class": {
    "class_0": {"precision": 0.92, "recall": 0.89},
    "class_1": {"precision": 0.91, "recall": 0.92}
  },
  "confusion_matrix": [[890, 23], [45, 892]],
  "timestamp": "2026-03-04T10:30:00Z"
}
```

## Quality Gates

- [ ] All metrics computed
- [ ] Visualizations generated
- [ ] Report exported
- [ ] Baseline comparison included
- [ ] Error cases identified
