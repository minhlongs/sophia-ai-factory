---
description: 🗄️ Feature Store — Centralized Feature Engineering & Serving
argument-hint: [action] [feature_group] [options]
---

**Think** để quản lý features với Feature Store: <action>feature $ARGUMENTS</action>

## 🏪 Feature Store Context

Project: `apps/analytics/`
Tech: `Feast · Tecton · Hopsworks · Pandas · Redis · BigQuery`

## Quick Command Map

| Task | Command |
|------|---------|
| Create feature group | `/feature-store create user-features --source bigquery` |
| Register feature | `/feature-store register user-features features/user_age.py` |
| Ingest features | `/feature-store ingest user-features --source raw_data` |
| Get training data | `/feature-store get-training-data user-features --output train.parquet` |
| Serve online | `/feature-store serve user-features --backend redis` |
| Get features | `/feature-store get user-features --entities user_123,user_456` |
| Monitor quality | `/feature-store monitor user-features --threshold 0.95` |

## Workflow

### 1. Parse Arguments
```
- action: create/register/ingest/get/serve/monitor
- feature_group: Feature group name
- --source: Data source (bigquery/snowflake/s3/local)
- --entities: Entity identifiers
- --output: Output path for retrieved features
- --backend: Online backend (redis/dynamodb)
- --threshold: Quality threshold
- --version: Feature version
```

### 2. Route to Operation
```
├── Create      → create_feature_group()
├── Register    → register_features()
├── Ingest      → batch_ingest() / streaming_ingest()
├── Get         → get_features() / get_historical_features()
├── Serve       → start_online_serving()
└── Monitor     → monitor_feature_quality()
```

### 3. Execute Feature Operations
```python
# Feature Store workflow
1. Load feature definition
2. Connect to offline store (BigQuery/S3)
3. Connect to online store (Redis/DynamoDB)
4. Execute operation (CRUD/serve/monitor)
5. Log feature lineage
6. Update feature metadata
```

## Feature Definition (Feast)

```python
# features/user_features.py
from feast import Feature, FeatureView, Entity, ValueType
from datetime import timedelta

# Define Entity
user = Entity(
    name="user_id",
    value_type=ValueType.STRING,
    description="User ID",
)

# Define Feature View
user_features = FeatureView(
    name="user_features",
    entities=["user_id"],
    ttl=timedelta(days=365),
    features=[
        Feature(name="age", dtype=ValueType.INT32),
        Feature(name="gender", dtype=ValueType.STRING),
        Feature(name="country", dtype=ValueType.STRING),
        Feature(name="purchase_count_30d", dtype=ValueType.INT64),
        Feature(name="total_spent_30d", dtype=ValueType.FLOAT),
        Feature(name="avg_order_value", dtype=ValueType.FLOAT),
        Feature(name="last_purchase_days", dtype=ValueType.INT32),
        Feature(name="is_premium", dtype=ValueType.BOOL),
    ],
    online=True,  # Enable online serving
    source=user_source,  # BigQuery/Snowflake table
)
```

## Feature Transformations

```python
# features/transformations.py
from feast import FeatureView, Field
from feast.transformations import LambdaFeatureTransform
import pandas as pd

# Custom transformation
def calculate_recency(df: pd.DataFrame) -> pd.DataFrame:
    df['days_since_last_purchase'] = (
        pd.Timestamp.now() - df['last_purchase_date']
    ).dt.days
    return df

# Feature view with transformation
purchase_features = FeatureView(
    name="purchase_features",
    entities=["user_id"],
    ttl=timedelta(days=90),
    features=[
        Field(name="total_purchases", dtype=ValueType.INT64),
        Field(name="avg_purchase_amount", dtype=ValueType.FLOAT),
        Field(name="days_since_last_purchase", dtype=ValueType.INT32),
    ],
    source=purchase_source,
    transforms=[
        LambdaFeatureTransform(
            name="recency_calc",
            func=calculate_recency,
        )
    ],
)
```

## Offline Store Configuration

### BigQuery
```yaml
# feature_store.yaml
project: my-ml-project
registry: gs://my-bucket/feast/registry.db
provider: gcp
online_store:
  type: redis
  connection_string: localhost:6379
offline_store:
  type: bigquery
  dataset: my_project.features
  project: my-ml-project
```

### Snowflake
```yaml
# feature_store.yaml
provider: snowflake
offline_store:
  type: snowflake
  account: my-account
  database: ML_FEATURES
  schema: PUBLIC
  warehouse: COMPUTE_WH
  user: ${SNOWFLAKE_USER}
  password: ${SNOWFLAKE_PASSWORD}
```

## Feature Ingestion

### Batch Ingestion
```python
from feast import FeatureStore
import pandas as pd

fs = FeatureStore(repo_path=".")

# Load raw data
df = pd.read_csv("raw_data/user_activity.csv")

# Inest to feature store
fs.write_to_online_store(
    feature_view_name="user_features",
    df=df,
)
```

### Streaming Ingestion
```python
from kafka import KafkaConsumer
import json

consumer = KafkaConsumer(
    'user-events',
    bootstrap_servers=['localhost:9092'],
    value_deserializer=lambda x: json.loads(x.decode('utf-8'))
)

for event in consumer:
    # Transform event to features
    features = transform_event(event.value)
    # Write to online store
    fs.write_to_online_store("user_features", features)
```

## Feature Retrieval

### Get Current Features
```python
from feast import FeatureStore

fs = FeatureStore(repo_path=".")

# Get features for specific entities
features = fs.get_online_features(
    features=[
        "user_features:age",
        "user_features:purchase_count_30d",
        "user_features:avg_order_value",
    ],
    entity_rows=[
        {"user_id": "user_123"},
        {"user_id": "user_456"},
    ],
)

print(features.to_dict())
```

### Get Historical Features (Training Data)
```python
from feast import FeatureStore
from datetime import datetime

fs = FeatureStore(repo_path=".")

# Get historical features for model training
training_df = fs.get_historical_features(
    entity_df=pd.DataFrame({
        "user_id": ["user_123", "user_456", "user_789"],
        "event_timestamp": [
            datetime(2026, 1, 1),
            datetime(2026, 1, 1),
            datetime(2026, 1, 1),
        ],
    }),
    features=[
        "user_features:age",
        "user_features:gender",
        "user_features:purchase_count_30d",
        "user_features:total_spent_30d",
        "purchase_features:avg_purchase_amount",
    ],
).to_df()

# Save for training
training_df.to_parquet("training_data.parquet", index=False)
```

## Feature Quality Monitoring

```python
# Monitor feature quality
def monitor_feature_quality(
    feature_view: str,
    threshold: float = 0.95,
) -> dict:
    """
    Monitor feature quality metrics:
    - Null rate
    - Out of range values
    - Distribution drift
    - Freshness
    """
    metrics = {
        "null_rate": calculate_null_rate(feature_view),
        "out_of_range": detect_out_of_range(feature_view),
        "distribution_drift": calculate_psi(feature_view),
        "freshness_hours": get_feature_freshness(feature_view),
    }

    # Check against thresholds
    alerts = []
    if metrics["null_rate"] > (1 - threshold):
        alerts.append(f"High null rate: {metrics['null_rate']:.2%}")
    if metrics["freshness_hours"] > 24:
        alerts.append(f"Stale features: {metrics['freshness_hours']}h old")

    return {"metrics": metrics, "alerts": alerts}
```

## Feature Lineage

```python
# Track feature lineage
lineage = {
    "feature_view": "user_features",
    "source_table": "bigquery://ml-data.raw.user_events",
    "transformations": [
        "aggregate_30d_window",
        "calculate_recency",
        "normalize_amounts",
    ],
    "downstream_models": [
        "churn_predictor_v2",
        "ltv_estimator_v1",
    ],
    "owner": "ml-team",
    "created_at": "2026-01-15",
    "last_updated": "2026-03-04",
}
```

## Output Artifacts

```
features/
├── feature_store.yaml       # Feature store config
├── user_features.py         # Feature definitions
├── purchase_features.py     # More feature views
├── transforms/
│   ├── aggregations.py      # Feature transformations
│   └── normalizations.py    # Data normalization
└── tests/
    ├── test_features.py     # Feature unit tests
    └── validation.yaml      # Feature validation rules
```

## Quality Gates

- [ ] All features have descriptions
- [ ] Feature TTL configured
- [ ] Online serving enabled (if needed)
- [ ] Data validation rules defined
- [ ] Lineage tracking enabled
- [ ] Monitoring alerts configured
