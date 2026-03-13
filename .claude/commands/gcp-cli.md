---
description: 🌩️ GCP CLI — Google Cloud Resources, GCS, Compute Engine, Cloud Functions
argument-hint: [gcs|compute|functions] [--project=my-project]
---

**Think harder** để gcp cli: <$ARGUMENTS>

**IMPORTANT:** GCP credentials PHẢI qua gcloud auth, service accounts với least privilege.

## gcloud Setup

```bash
# === Login ===
gcloud auth login

# === List Projects ===
gcloud projects list

# === Set Project ===
gcloud config set project my-project

# === List Config ===
gcloud config list
```

## Cloud Storage (GCS)

```bash
# === List Buckets ===
gsutil ls

# === List Objects ===
gsutil ls gs://my-bucket/

# === Upload File ===
gsutil cp file.txt gs://my-bucket/path/

# === Upload Directory ===
gsutil -m sync -r ./local-folder gs://my-bucket/folder/

# === Download File ===
gsutil cp gs://my-bucket/file.txt .

# === Delete Object ===
gsutil rm gs://my-bucket/file.txt

# === Make Public ===
gsutil -m setmeta -h "Cache-Control:public, max-age=31536000" gs://my-bucket/**
```

## Compute Engine

```bash
# === List Instances ===
gcloud compute instances list

# === Create Instance ===
gcloud compute instances create my-vm --machine-type=e2-medium --zone=us-central1-a

# === Start Instance ===
gcloud compute instances start my-vm --zone=us-central1-a

# === SSH Connect ===
gcloud compute ssh my-vm --zone=us-central1-a

# === View Logs ===
gcloud compute instances tail-serial-port my-vm --zone=us-central1-a
```

## Cloud Functions

```bash
# === List Functions ===
gcloud functions list

# === Deploy Function ===
gcloud functions deploy my-function --runtime nodejs18 --trigger-http --entry-point myHandler

# === Invoke Function ===
gcloud functions call my-function --data '{"name":"test"}'

# === View Logs ===
gcloud functions logs read my-function --limit 50

# === Delete Function ===
gcloud functions delete my-function
```

## Related Commands

- `/aws-cli` — Amazon Web Services
- `/azure-cli` — Microsoft Azure
- `/deploy` — Deploy application
