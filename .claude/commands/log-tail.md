---
description: 📜 Log Tail — Real-time Logs, Log Filtering, Log Analysis
argument-hint: [--level=error] [--service=api] [--since=1h]
---

**Think harder** để log tail: <$ARGUMENTS>

**IMPORTANT:** Logs PHẢI structured (JSON), searchable, real-time accessible.

## Local Log Tail

```bash
# === Tail Recent Logs ===
tail -f logs/app.log
tail -n 100 -f logs/app.log

# === Filter by Level ===
tail -f logs/app.log | grep "ERROR"
tail -f logs/app.log | grep -E "(ERROR|WARN)"

# === Exclude Noise ===
tail -f logs/app.log | grep -v "DEBUG"

# === Multiple Files ===
tail -f logs/{app,error,access}.log

# === Colored Output ===
tail -f logs/app.log | grep --color=always "ERROR"
```

## Docker Logs

```bash
# === Follow Logs ===
docker logs -f container_name
docker logs -f --tail 100 container_name

# === With Timestamps ===
docker logs -f --timestamps container_name

# === Since/Until ===
docker logs -f --since 2026-03-04T10:00:00 container_name
docker logs -f --since 1h container_name

# === All Containers ===
docker ps --format '{{.Names}}' | xargs -I {} docker logs {}
```

## Kubernetes Logs

```bash
# === Pod Logs ===
kubectl logs -f pod-name
kubectl logs -f deployment/myapp

# === Previous Instance ===
kubectl logs -f pod-name --previous

# === All Containers ===
kubectl logs -f pod-name --all-containers

# === By Label ===
kubectl logs -f -l app=myapp --all-containers
```

## Cloud Logging

```bash
# === GCP Cloud Logging ===
gcloud logging read "resource.type=gce_instance" --limit 50 --format=json

# === AWS CloudWatch ===
aws logs tail /aws/lambda/my-function --follow

# === Vercel Logs ===
vercel logs my-app --follow
vercel logs my-app --level error
```

## Related Commands

- `/monitor` — System monitoring
- `/alert` — Alert configuration
- `/health-check` — Health checks
