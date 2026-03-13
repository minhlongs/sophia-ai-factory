---
description: 🗂️ Prepare training datasets (ETL pipeline)
argument-hint: [source] [output] [transforms]
---

**Think** để prepare data với ETL pipeline: <action>prep $ARGUMENTS</action>

## 📊 Data Preparation Context

Project: `apps/analytics/`
Tech: `Pandas · Polars · Apache Beam · TFRecord · Parquet`

## Quick Command Map

| Task | Command |
|------|---------|
| ETL từ CSV | `/data-prep raw/train.csv data/train --format parquet` |
| Image dataset | `/data-prep images/ data/images --type image --resize 224` |
| Text dataset | `/data-prep corpus/ data/text --type text --tokenizer bert` |
| Split dataset | `/data-prep data/full --split 80/10/10` |
| Validate data | `/data-prep data/train --validate` |
| Upload to GCS | `/data-prep data/train --upload gs://bucket/datasets/` |

## Workflow

### 1. Parse Arguments
```
- source: Input data path (file/folder/GCS)
- output: Output dataset path
- transforms: Transformations to apply
- --type: Data type (tabular/image/text/audio)
- --format: Output format (parquet/tfrecord/webdataset)
- --split: Train/val/test ratios
- --validate: Run validation checks
- --upload: Upload to cloud storage
```

### 2. Route to Operation
```
├── Tabular     → process_tabular()
├── Image       → process_image()
├── Text        → process_text()
├── Audio       → process_audio()
├── Split       → create_splits()
└── Validate    → run_validation()
```

### 3. Execute ETL Pipeline
```python
# ETL workflow
1. Extract → load from source (CSV/JSON/DB/GCS)
2. Validate → schema checks + quality gates
3. Transform → clean + normalize + augment
4. Load → write to output format
5. Split → train/val/test partitions
6. Statistics → compute + save dataset stats
```

## Transform Pipeline

### Tabular Data
```python
transforms = [
    "drop_duplicates",
    "handle_missing:mean",      # or median/mode/drop
    "encode_categorical:onehot", # or label/target
    "scale_features:standard",  # or minmax/robust
    "balance_classes:smote",    # or undersample/oversample
]
```

### Image Data
```python
transforms = [
    "resize:224x224",
    "normalize:imagenet_stats",
    "augment:random_flip",
    "augment:color_jitter",
    "augment:random_rotation",
]
```

### Text Data
```python
transforms = [
    "clean:text",               # remove special chars
    "normalize:unicode",
    "tokenize:bert",            # or wordpiece/sentencepiece
    "pad:max_len_512",
    "create_attention_mask",
]
```

## Output Formats

### Parquet (Tabular)
```python
df.to_parquet(
    "data/train.parquet",
    compression="snappy",
    index=False
)
```

### TFRecord (TensorFlow)
```python
# Serialized Example protocol buffer
tf.train.Example(features=tf.train.Features(feature={
    "image": tf.train.Feature(bytes_list=...),
    "label": tf.train.Feature(int64_list=...),
}))
```

### WebDataset (PyTorch)
```python
# TAR archive with shuffled samples
webdataset.WebDataset("data/train.tar")
```

## Dataset Statistics

```json
{
  "name": "imagenet-clean",
  "created_at": "2026-03-04",
  "splits": {
    "train": {"samples": 1280000, "size_gb": 142},
    "val": {"samples": 50000, "size_gb": 5.5},
    "test": {"samples": 50000, "size_gb": 5.5}
  },
  "classes": 1000,
  "format": "webdataset",
  "checksum": "sha256:abc123..."
}
```

## Quality Gates

- [ ] No missing values (or handled)
- [ ] Class distribution balanced
- [ ] No data leakage between splits
- [ ] Schema validated
- [ ] Checksum computed
- [ ] Documentation updated
