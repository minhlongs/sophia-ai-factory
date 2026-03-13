---
description: ✅ Data Validation — Data Quality Checks with Great Expectations
argument-hint: [dataset] [action] [options]
---

**Think** để validate data quality với Great Expectations: <action>validate $ARGUMENTS</action>

## 🔍 Data Validation Context

Project: `apps/analytics/`
Tech: `Great Expectations · Pydantic · Pandera · TensorFlow Data Validation`

## Quick Command Map

| Task | Command |
|------|---------|
| Init Great Expectations | `/data-validation init --datasource bigquery` |
| Create expectations | `/data-validation create-expectations train.parquet` |
| Validate dataset | `/data-validation validate train.parquet --suite default` |
| Build data docs | `/data-validation build-docs --open` |
| Checkpoint data | `/data-validation checkpoint run --suite default` |
| Schema validation | `/data-validation schema validate.json --data input.csv` |

## Workflow

### 1. Parse Arguments
```
- dataset: Input dataset path
- action: init/create-expectations/validate/build-docs/checkpoint
- --datasource: Data source type (bigquery/snowflake/postgres/s3/local)
- --suite: Expectation suite name
- --output: Validation result output path
- --open: Open data docs after build
- --threshold: Validation pass threshold (default: 1.0)
```

### 2. Route to Operation
```
├── Init              → init_great_expectations()
├── Create Expectations → create_expectations()
├── Validate          → validate_data()
├── Build Docs        → build_data_docs()
├── Checkpoint        → run_checkpoint()
└── Schema Validate   → validate_schema()
```

### 3. Execute Validation
```python
# Data validation workflow
1. Load expectation suite
2. Connect to data source
3. Run expectations against data
4. Generate validation results
5. Build data docs (optional)
6. Send alerts if validation fails
```

## Great Expectations Setup

### Initialize
```bash
# Initialize Great Expectations
great_expectations init

# Create datasource (BigQuery)
great_expectations datasource new bigquery

# Create expectation suite
great_expectations suite new user_data_suite
```

### Project Structure
```
great_expectations/
├── great_expectations.yml      # Main config
├── expectations/
│   ├── user_data_suite/
│   │   ├── users.json
│   │   └── transactions.json
│   └── critical_suite/
│       └── core_metrics.json
├── checkpoints/
│   ├── validate_users.yml
│   └── validate_transactions.yml
├── uncommitted/
│   ├── validations/
│   ├── data_docs/
│   └── credentials/
└── plugins/
    └── custom_expectations.py
```

## Expectation Examples

### Tabular Data Expectations
```python
import great_expectations as gx
from great_expectations.core.expectation_configuration import ExpectationConfiguration

# Create expectation suite
suite = gx.ExpectationSuite(name="user_data_suite")

# Add expectations
suite.add_expectation(
    ExpectationConfiguration(
        expectation_type="expect_table_row_count_to_be_between",
        meta={"column": None},
        kwargs={"min_value": 1000, "max_value": 1000000},
    )
)

suite.add_expectation(
    ExpectationConfiguration(
        expectation_type="expect_column_values_to_not_be_null",
        meta={"column": "user_id"},
        kwargs={"column": "user_id"},
    )
)

suite.add_expectation(
    ExpectationConfiguration(
        expectation_type="expect_column_values_to_be_unique",
        meta={"column": "user_id"},
        kwargs={"column": "user_id"},
    )
)

suite.add_expectation(
    ExpectationConfiguration(
        expectation_type="expect_column_values_to_be_between",
        meta={"column": "age"},
        kwargs={"column": "age", "min_value": 18, "max_value": 100},
    )
)

suite.add_expectation(
    ExpectationConfiguration(
        expectation_type="expect_column_values_to_be_in_set",
        meta={"column": "country"},
        kwargs={"column": "country", "value_set": ["US", "UK", "VN", "SG", "JP"]},
    )
)

suite.add_expectation(
    ExpectationConfiguration(
        expectation_type="expect_column_mean_to_be_between",
        meta={"column": "purchase_amount"},
        kwargs={"column": "purchase_amount", "min_value": 10, "max_value": 500},
    )
)

# Save suite
suite.save()
```

### Distribution Expectations
```python
# Expect column distribution to match reference
suite.add_expectation(
    ExpectationConfiguration(
        expectation_type="expect_column_kl_divergence_to_be_less_than",
        kwargs={
            "column": "product_category",
            "partition_object": {
                "bins": ["Electronics", "Clothing", "Food", "Books", "Other"],
                "weights": [0.3, 0.25, 0.2, 0.15, 0.1],
            },
            "threshold": 0.1,
        },
    )
)

# Expect correlation between columns
suite.add_expectation(
    ExpectationConfiguration(
        expectation_type="expect_column_pair_correlation_to_be_between",
        kwargs={
            "column_A": "income",
            "column_B": "purchase_amount",
            "min_value": 0.3,
            "max_value": 0.9,
        },
    )
)
```

### Date/Time Expectations
```python
# Expect date format
suite.add_expectation(
    ExpectationConfiguration(
        expectation_type="expect_column_values_to_match_regex",
        kwargs={
            "column": "created_at",
            "regex": r"^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}",
        },
    )
)

# Expect date range
suite.add_expectation(
    ExpectationConfiguration(
        expectation_type="expect_column_min_to_be_between",
        kwargs={
            "column": "created_at",
            "min_value": "2025-01-01",
            "max_value": "2026-12-31",
            "parse_strings_as_datetimes": True,
        },
    )
)
```

## Validation Execution

### Batch Validation
```python
import great_expectations as gx

# Initialize context
context = gx.get_context()

# Create batch request
batch_request = {
    "datasource_name": "my_datasource",
    "data_connector_name": "default_inferred_data_connector",
    "data_asset_name": "users",
    "batch_spec": {"path": "data/users.parquet"},
}

# Get validator
validator = gx.Validator(
    batch_request=batch_request,
    expectation_suite_name="user_data_suite",
    context=context,
)

# Run validation
results = validator.validate()

# Check results
print(f"Success: {results.success}")
print(f"Failed expectations: {results.statistics['failed_expectations']}")
```

### Checkpoint Execution
```yaml
# checkpoints/validate_users.yml
name: validate_users
config_version: 1.0
template_name:
module_name: great_expectations.checkpoint
class_name: Checkpoint

run_name_template: "%Y%m%d-%H%M%S-validate-users"

batch_request:
  datasource_name: bigquery_datasource
  data_connector_name: default_inferred_data_connector
  data_asset_name: ml_features.users

expectation_suite_name: user_data_suite

action_list:
  - name: store_validation_result
    action:
      class_name: StoreValidationResultAction
  - name: store_evaluation_params
    action:
      class_name: StoreEvaluationParametersAction
  - name: update_data_docs
    action:
      class_name: UpdateDataDocsAction
  - name: send_slack_notification
    action:
      class_name: SlackNotificationAction
      slack_webhook: ${SLACK_WEBHOOK}
      notify_on: all
```

### Run Checkpoint
```bash
# Run checkpoint
great_expectations checkpoint run validate_users

# Run with specific suite
great_expectations checkpoint run validate_users --suite critical_suite

# Run with environment variable override
GE_BATCH_KWARGS_PATH=batch_config.yml great_expectations checkpoint run validate_users
```

## Data Docs

### Build Data Docs
```python
import great_expectations as gx

context = gx.get_context()

# Build data docs for all suites
context.build_data_docs()

# Build for specific suite
context.build_data_docs(
    expectation_suite_name="user_data_suite",
    checkpoint_name="validate_users",
)

# Open data docs in browser
import webbrowser
webbrowser.open("file:///path/to/great_expectations/uncommitted/data_docs/local_site/index.html")
```

### Custom Data Docs Template
```html
<!-- templates/custom_data_docs.html -->
<!DOCTYPE html>
<html>
<head>
    <title>Data Quality Report - {{ suite_name }}</title>
    <style>
        .success { color: green; }
        .failed { color: red; }
        .warning { color: orange; }
    </style>
</head>
<body>
    <h1>Data Quality Report</h1>
    <h2>{{ suite_name }}</h2>
    <p>Generated: {{ timestamp }}</p>

    {% for expectation in expectations %}
    <div class="expectation {{ 'success' if expectation.success else 'failed' }}">
        <h3>{{ expectation.name }}</h3>
        <p>Result: {{ 'PASS' if expectation.success else 'FAIL' }}</p>
        {% if not expectation.success %}
        <p>Details: {{ expectation.failure_details }}</p>
        {% endif %}
    </div>
    {% endfor %}
</body>
</html>
```

## Schema Validation (Pydantic)

### Define Schema
```python
from pydantic import BaseModel, Field, validator
from datetime import datetime
from typing import Optional, List

class UserRecord(BaseModel):
    user_id: str = Field(..., min_length=1, max_length=50)
    email: str = Field(..., pattern=r'^[\w\.-]+@[\w\.-]+\.\w+$')
    age: int = Field(..., ge=18, le=120)
    country: str = Field(..., min_length=2, max_length=2)
    created_at: datetime
    purchase_count: Optional[int] = Field(None, ge=0)
    total_spent: Optional[float] = Field(None, ge=0)

    @validator('country')
    def validate_country_code(cls, v):
        valid_countries = {'US', 'UK', 'VN', 'SG', 'JP', 'AU', 'CA'}
        if v not in valid_countries:
            raise ValueError(f'Invalid country code: {v}')
        return v

    @validator('total_spent')
    def validate_total_spent(cls, v, values):
        if v is not None and values.get('purchase_count', 0) == 0:
            raise ValueError('total_spent must be null if purchase_count is 0')
        return v
```

### Validate Dataset
```python
import pandas as pd
from pydantic import ValidationError

def validate_with_pydantic(
    df: pd.DataFrame,
    schema: BaseModel,
) -> dict:
    """Validate DataFrame against Pydantic schema."""
    errors = []
    valid_records = []

    for idx, row in df.iterrows():
        try:
            record = schema(**row.to_dict())
            valid_records.append(record)
        except ValidationError as e:
            errors.append({
                "row": idx,
                "errors": e.errors(),
            })

    return {
        "total_records": len(df),
        "valid_records": len(valid_records),
        "invalid_records": len(errors),
        "pass_rate": len(valid_records) / len(df),
        "errors": errors[:100],  # Limit to first 100 errors
    }
```

## Expectation Suite Gallery

```python
# Create expectation gallery
from great_expectations.core.expectation_configuration import ExpectationConfiguration

EXPECTATION_GALLERY = {
    "completeness": [
        "expect_column_values_to_not_be_null",
        "expect_column_values_to_not_be_nan",
    ],
    "uniqueness": [
        "expect_column_values_to_be_unique",
        "expect_compound_columns_to_be_unique",
    ],
    "validity": [
        "expect_column_values_to_be_in_set",
        "expect_column_values_to_match_regex",
        "expect_column_values_to_be_between",
        "expect_column_values_to_match_regex_list",
    ],
    "consistency": [
        "expect_column_values_a_to_be_greater_than_b",
        "expect_column_pair_values_to_be_equal",
    ],
    "distribution": [
        "expect_column_kl_divergence_to_be_less_than",
        "expect_column_chisquare_test_p_value_to_be_greater_than",
        "expect_column_proportion_of_unique_values_to_be_between",
    ],
    "statistics": [
        "expect_column_mean_to_be_between",
        "expect_column_median_to_be_between",
        "expect_column_stdev_to_be_between",
        "expect_column_min_to_be_between",
        "expect_column_max_to_be_between",
    ],
}
```

## Output Artifacts

```
great_expectations/
├── expectations/
│   └── user_data_suite.json
├── checkpoints/
│   └── validate_users.yml
├── uncommitted/
│   ├── validations/
│   │   └── user_data_suite/
│   │       └── validation_results_20260304.json
│   ├── data_docs/
│   │   └── local_site/
│   │       └── index.html
│   └── logs/
│       └── validation.log
└── validation_config.yaml
```

## Quality Gates

- [ ] All critical columns have expectations
- [ ] Validation suite version controlled
- [ ] Checkpoint configured with alerts
- [ ] Data docs accessible
- [ ] Failure runbook documented
