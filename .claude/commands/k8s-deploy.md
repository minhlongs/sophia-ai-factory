---
description: ☸️ Kubernetes Deploy — K8s Manifests, Rollouts, Service Mesh
argument-hint: [--env=production] [--replicas=3]
---

**Think harder** để k8s deploy: <$ARGUMENTS>

**IMPORTANT:** Deployments PHẢI có health checks, resource limits, HPA.

## Deployment Manifest

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: myapp
  namespace: production
spec:
  replicas: 3
  selector:
    matchLabels:
      app: myapp
  template:
    metadata:
      labels:
        app: myapp
    spec:
      containers:
      - name: myapp
        image: myapp:1.0.0
        ports:
        - containerPort: 3000
        resources:
          limits:
            memory: "512Mi"
            cpu: "500m"
          requests:
            memory: "256Mi"
            cpu: "250m"
        livenessProbe:
          httpGet:
            path: /health
            port: 3000
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /ready
            port: 3000
          initialDelaySeconds: 5
          periodSeconds: 5
```

## Kubectl Commands

```bash
# === Apply Deployment ===
kubectl apply -f k8s/deployment.yaml

# === Check Status ===
kubectl get deployments
kubectl get pods
kubectl get services

# === View Logs ===
kubectl logs -f deployment/myapp

# === Rollout Status ===
kubectl rollout status deployment/myapp

# === Rollback ===
kubectl rollout undo deployment/myapp

# === Scale ===
kubectl scale deployment/myapp --replicas=5
```

## Horizontal Pod Autoscaler

```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: myapp-hpa
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: myapp
  minReplicas: 2
  maxReplicas: 10
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
```

## Related Commands

- `/docker-build` — Build container images
- `/helm-install` — Helm package manager
- `/deploy` — Deploy application
