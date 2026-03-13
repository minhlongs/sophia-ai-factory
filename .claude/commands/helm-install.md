---
description: ⎈ Helm Install — K8s Package Manager, Charts, Values Override
argument-hint: [install|upgrade|rollback] [--values=values.yaml]
---

**Think harder** để helm install: <$ARGUMENTS>

**IMPORTANT:** Charts PHẢI version-controlled, values separated per environment.

## Helm Commands

```bash
# === Install Chart ===
helm install myapp ./charts/myapp -f values.yaml

# === Install with Namespace ===
helm install myapp ./charts/myapp --namespace production --create-namespace

# === Upgrade Release ===
helm upgrade myapp ./charts/myapp -f values-prod.yaml

# === Rollback ===
helm rollback myapp 1

# === Uninstall ===
helm uninstall myapp

# === List Releases ===
helm list
helm list --all-namespaces

# === History ===
helm history myapp

# === Status ===
helm status myapp
```

## Chart Structure

```
charts/myapp/
├── Chart.yaml          # Chart metadata
├── values.yaml         # Default values
├── values-prod.yaml    # Production overrides
├── values-staging.yaml # Staging overrides
└── templates/
    ├── deployment.yaml
    ├── service.yaml
    ├── ingress.yaml
    ├── configmap.yaml
    └── _helpers.tpl
```

## Chart.yaml Template

```yaml
apiVersion: v2
name: myapp
description: My Application Helm Chart
type: application
version: 1.0.0
appVersion: "1.0.0"
dependencies:
  - name: postgresql
    version: "12.0.0"
    repository: "https://charts.bitnami.com/bitnami"
```

## Values Override

```yaml
# values-prod.yaml
replicaCount: 3

image:
  repository: gcr.io/project/myapp
  tag: "1.0.0"
  pullPolicy: Always

resources:
  limits:
    cpu: 500m
    memory: 512Mi
  requests:
    cpu: 250m
    memory: 256Mi

autoscaling:
  enabled: true
  minReplicas: 2
  maxReplicas: 10
```

## Related Commands

- `/k8s-deploy` — Kubernetes manifests
- `/docker-build` — Container images
- `/deploy` — Deploy application
