---
description: ☁️ AWS CLI — Cloud Resources, S3, EC2, Lambda, IAM
argument-hint: [s3|ec2|lambda|iam] [--region=us-east-1]
---

**Think harder** để aws cli: <$ARGUMENTS>

**IMPORTANT:** AWS credentials PHẢI trong secure storage, never committed.

## S3 Commands

```bash
# === List Buckets ===
aws s3 ls

# === List Objects ===
aws s3 ls s3://my-bucket/

# === Upload File ===
aws s3 cp file.txt s3://my-bucket/path/

# === Upload Directory ===
aws s3 sync ./local-folder s3://my-bucket/folder/

# === Download File ===
aws s3 cp s3://my-bucket/file.txt .

# === Delete Object ===
aws s3 rm s3://my-bucket/file.txt

# === Presigned URL ===
aws s3 presign s3://my-bucket/file.txt --expire-in 3600
```

## EC2 Commands

```bash
# === List Instances ===
aws ec2 describe-instances --query 'Reservations[*].Instances[*].[InstanceId,State.Name,Tags[?Key==`Name`].Value[]]' --output table

# === Start Instance ===
aws ec2 start-instances --instance-ids i-1234567890abcdef0

# === Stop Instance ===
aws ec2 stop-instances --instance-ids i-1234567890abcdef0

# === Create Snapshot ===
aws ec2 create-snapshot --volume-id vol-123456 --description "Backup"
```

## Lambda Commands

```bash
# === List Functions ===
aws lambda list-functions

# === Invoke Function ===
aws lambda invoke --function-name my-function response.json

# === Update Code ===
aws lambda update-function-code --function-name my-function --zip-file fileb://function.zip

# === View Logs ===
aws logs tail /aws/lambda/my-function --follow
```

## IAM Commands

```bash
# === List Users ===
aws iam list-users

# === Create User ===
aws iam create-user --user-name newuser

# === Attach Policy ===
aws iam attach-user-policy --user-name newuser --policy-arn arn:aws:iam::aws:policy/ReadOnlyAccess

# === List Access Keys ===
aws iam list-access-keys --user-name newuser
```

## Related Commands

- `/gcp-cli` — Google Cloud Platform
- `/azure-cli` — Microsoft Azure
- `/deploy` — Deploy application
