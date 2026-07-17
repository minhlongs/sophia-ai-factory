---
name: m1-max-cr8809-brainstorm-260717
description: Brainstorm optimization for M1 Max (64GB) + CR8809 LAN setup
metadata:
  type: reference
---

# M1 Max + CR8809 LAN Optimization Brainstorm

**Date:** 2026-07-17 | **Hardware:** M1 Max 64GB/24GPU/2TB | **Router:** CR8809 185MB/1Gbps | **WAN:** FPT ~230/118 Mbps

---

## 1. Network

### Local throughput
- CR8809 flow offload is ON — hardware-assigned core handles packet forwarding, leaving CPU at ~33% idle. No bottleneck here.
- CR8809 has no hardware NAT acceleration — WAN throughput capped at ~800 Mbps regardless of FPT speed (irrelevant since FPT delivers ~230 Mbps).
- Local LAN (192.168.50.0/24) is flat — no VLANs, all devices share the same broadcast domain.

| Action | Impact |
|--------|--------|
| Add `192.168.50.0/24` to WARP bypass list | Eliminates WARP overhead for local traffic (Docker, Time Machine, SSH). WARP typically adds 40-60ms + ~5% overhead |
| Adjust WARP MTU from 1280 to 1380 | +3% throughput on WARP routes, particularly helps SSH/SCP to remote servers |
| Enable WARP selective routing | Exclude local subnet, route only WAN traffic through WARP |
| Disable `frequent_lt_join` notifications in macOS Wi-Fi | Reduces scan noise when staying on Ethernet |

### WAN optimization
- OpenWrt DNS over HTTPS (Cloudflare 1.1.1.1 or NextDNS) going through WARP has no additional cost — WARP already encrypts traffic to Cloudflare edge. But local DNS queries should NOT go through WARP — add DoH exclusion for `192.168.50.1` (CR8809 itself).
- iperf3 from Mac → CR8809 (as server): expect 900-950 Mbps. If lower, check cable (Cat5e minimum, Cat6 preferred for 1Gbps sustained).

---

## 2. AI / ML (64GB Unified RAM)

Key insight: M1 Max has 24 GPU cores sharing the same 64GB pool. No discrete VRAM separate from system RAM. Models run in memory.

### What fits (realistic, not theoretical max)

| Model | Quantization | RAM needed | Performance |
|-------|-------------|------------|-------------|
| Llama 3 8B | Q4_K_M | ~5GB | Fast (50-70 tok/s) |
| Mixtral 8x7B | Q4_K_M | ~26GB | Good (20-30 tok/s) |
| Llama 3 70B | Q2_K to Q4_K | ~35-55GB | Usable (8-20 tok/s) |
| LFM2 (>=70B) | Q2_K | ~35-40GB | Slower but functional |
| DeepSeek-V3 | IQ4 | ~60GB | **fills RAM, needs swapping** |
| Qwen 2.5 72B | Q4_K_M | ~47GB | Good (15-25 tok/s) |

**Sweet spot for Mac daily driver:** Mixtral 8x7B (26GB) leaves 30GB+ for OS, Docker, databases. Swap in Llama 3 70B Q4 when you don't need other heavy apps.

### Frameworks

| Tool | Metal Support | Notes |
|------|--------------|-------|
| Ollama | Excellent | Easiest setup, Open WebUI compatible |
| MLX-LM | Excellent (Apple native) | Best for fine-tuning, research workflows |
| llama.cpp (llamafile) | Good | Single binary, no runtime deps |
| LM Studio | Good | GUI, model manager built-in |

**Recommendation:** Start with `Ollama + Open WebUI` (Docker containers). Single command, works immediately. MLX-LM is for when you need to fine-tune.

### Memory budget for model + services coexistence

```
macOS base:           6-8 GB  (idle with common apps + Electron)
Docker daemon:        1-2 GB
PostgreSQL:           1-4 GB  (depends on dataset size)
Redis:                0.5 GB
Neo4j:                2-6 GB  (depends on graph size)
N8N + workers:        1-2 GB
───────────────
Base services:        ~12-22 GB

Available for LLM:   ~42-52 GB  (plenty for any single model)
```

This is the critical advantage of unified memory vs discrete VRAM — the OS, services, and model all share the pool. No data copies between GPU and RAM.

---

## 3. Self-Hosted Services

### Stack recommendation (fits in ~30GB baseline)

| Service | Container | RAM (~) | Why |
|---------|-----------|---------|-----|
| PostgreSQL 17 | `postgres:17-alpine` | 1-4GB | Main data store |
| Redis 7 | `redis:7-alpine` | 0.5GB | Cache + job queue |
| Neo4j 5 | `neo4j:5-community` | 2-6GB | Knowledge graph |
| MinIO | `minio/minio` | 0.5GB | S3-compatible object storage |
| N8N | `n8nio/n8n` | 1-2GB | Workflow automation |
| PostHog | `posthog/posthog` | 2-4GB | Analytics (self-hosted) |
| Traefik | `traefik:v3` | 0.1GB | Reverse proxy (shared SSL) |
| Ollama | `ollama/ollama` | 2-10GB | LLM inference (model-dependent) |

**Total: ~9-29 GB** depending on data volume + model choice.

### Network exposure
All services bind to `127.0.0.1` or the `docker0` bridge. Traefik handles the public-facing reverse proxy on ports 80/443. No service exposes a raw port to the LAN without intentional routing.

### What NOT to self-host on this box
- Elasticsearch (RAM hog: requires 4GB+ minimum, easily 16GB+ in practice)
- Kafka (overkill unless you already have it)
- Full Odoo / ERPNext (treat as dedicated server later)

---

## 4. Dev Workflow Speedups

### Docker layer caching
```bash
# In docker-compose.yml — order: static → deps → source
# This ensures code changes only rebuild the last layer
```

### Local registry mirror
```bash
# On CR8809 (if USB storage added later) or Mac itself:
# self-hosted registry container cuts pull time from 30s → 1s for cached layers
```

### Rust/TS build parallelism
- M1 Max: 10 performance cores. Set `MAKEFLAGS="-j10"` for Rust, `EXTRA_TSFLAGS="--maxWorkers=4"` for tsc.
- Xcode command line tools: `sudo xcode-select --install` — needed for native builds.

### TypeScript project references
```json
// tsconfig.json — enable composite projects
{ "compilerOptions": { "composite": true, "incremental": true } }
```
Saves ~40% time on large monorepos by only rebuilding changed packages.

### Turborepo (if monorepo)
```json
// turbo.json — pipeline with caching enabled
{ "pipeline": { "build": { "dependsOn": ["^build"], "cache": true } } }
```
Warm cache = instant "no-op" builds.

### LLM model reuse between shells
Ollama models live in `~/.ollama/models` — shared across all terminals. Pull once, use everywhere.

### Hot reload + LLM streaming together
When running both `next dev --turbo` and `ollama serve`, the M1 Max handles both comfortably because they're in different RAM regions and GPU work is preemptible.

---

## 5. Security

### Threat model (specific to this setup)

| Threat | Likelihood | Impact | Mitigation |
|--------|-----------|--------|------------|
| WARP tunnel compromised | Low | Medium | Cloudflare manages keys; rotate if OPSEC requires |
| Docker escape from Ollama | Low | High | Run Ollama as non-root, no privileged mode |
| Local network sniffing | Medium | Low | All local traffic is unencrypted; add 802.1X or WPA3 on WiFi |
| SSRF from N8N workflows | Medium | Medium | Network policy in Docker Compose; no `network_mode: host` |
| LLM prompt injection → data exfil | Medium | Medium | Sanitize N8N outputs before passing to LLM calls |

### Prioritized

1. **Docker Compose: use `user: "1000:1000"` for all non-root services** — prevents container escape from reaching host filesystem.
2. **Enable macOS firewall + stealth mode:** `sudo /usr/libexec/ApplicationFirewall/socketfilterfw --setstealthmode on`
3. **Traefik with Let's Encrypt** — auto-SSL for any public-facing service. No need for manual cert management.
4. **Never pass secrets via command-line** — use `.env` files with proper permissions (`chmod 600`), or better: `pass` or 1Password CLI injection.
5. **Regular image scanning:** `trivy image <image>` before deploying — catches known CVEs in base images.

### WARP specifics
- WARP encrypts traffic from device → Cloudflare edge. After that, traffic goes to destination unencrypted unless it's HTTPS.
- Local traffic (192.168.50.0/24) does NOT need WARP. Exclude it.
- WARP does NOT encrypt traffic visible on the CR8809 LAN — only the outbound WAN path. For internal service-to-service calls, use mTLS or internal network isolation.

---

## 6. Quick Wins (This Week)

Priority order, effort low → high, impact high → low:

1. **[15 min]** Add local subnet bypass to WARP (macOS WARP client settings → Split Tunnel → exclude 192.168.50.0/24). **Immediate latency relief for SSH, Docker, Time Machine.**

2. **[30 min]** Install Ollama + Open WebUI via Docker Compose. **Immediate local LLM capability — no cloud API costs.**

3. **[20 min]** Run iperf3 Mac ↔ CR8809 to verify 900+ Mbps LAN. If under 800 Mbps, replace Ethernet cable — cheap Cat5e replacement solves it.

4. **[15 min]** Configure Traefik as reverse proxy for local services. One entry point instead of remembering port numbers.

5. **[30 min]** Switch macOS DNS to 1.1.1.1 (or NextDNS) directly instead of through WARP. **Faster DNS resolution (~10ms vs ~50ms through tunnel).**

6. **[10 min]** Enable macOS Firewall + Stealth Mode. `sudo /usr/libexec/ApplicationFirewall/socketfilterfw --setglobalstate on && sudo /usr/libexec/ApplicationFirewall/socketfilterfw --setstealthmode on`

7. **[15 min]** Set up Time Machine to external USB drive or network share. **2TB SSD fills fast** — offload OS backup.

8. **[1 hour]** Create docker-compose.yml skeleton: PostgreSQL + Redis + Ollama + Traefik. **Foundation for all self-hosted services.**

9. **[30 min]** Add `docker-compose.override.yml` for development: live-reload mounts, environment variable files, no auto-restart on crash during debugging.

10. **[10 min]** Install `trivy` (via brew) and scan current Docker images: `brew install trivy && trivy image postgres:17-alpine`. Know your CVE baseline before expanding.

---

## Open Questions

- Is the USB storage for CR8809 adding a local NAS, or is it for firmware/log purposes? (Affects whether Time Machine targets should be network or USB.)
- What's the primary AI workload: inference only, or also fine-tuning? (Changes whether MLX-LM track or Ollama-only.)
- Is Docker Desktop or Colima/Rancher Desktop? (Colima uses less RAM, Docker Desktop has better UX but heavier footprint.)
