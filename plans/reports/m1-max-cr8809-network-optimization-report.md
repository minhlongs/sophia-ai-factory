# CR8809 Network Optimization Report

**Date:** 2026-07-18  
**Router:** Xiaomi AX3000 / CR8809, ImmortalWrt 24.10-SNAPSHOT r32960  
**Chipset:** Qualcomm IPQ5018 (ARM Cortex-A53 quad-core 1.0GHz, 185MB RAM)  
**WAN:** PPPoE VLAN 5, FPT FTTH, IP 58.187.152.141  

---

## 1. SSH Access Fixed

**Problem:** Dropbear only reads `/etc/dropbear/authorized_keys` (not `~/.ssh/`).  
**Solution:** Password auth via `expect` wrapper (`/tmp/cr8809_ssh.py`).  
**Status:** ✅ Working.

---

## 2. Tunables Applied

| Setting | Value | Method |
|---------|-------|--------|
| DNS servers | 1.1.1.1, 1.0.0.1, 8.8.8.8 | UCI dhcp → /etc/resolv.conf.auto |
| MSS clamping | TCPMSS --clamp-mss-to-pmtu | nft rule in chain `forward` |
| conntrack_max | 32768 | /etc/sysctl.conf (persistent) |
| conntrack_tcp_timeout_established | 300s | /etc/sysctl.conf |
| conntrack_tcp_timeout_time_wait | 120s | /etc/sysctl.conf |
| rmem_default | 4 MB | sysctl |
| wmem_default | 4 MB | sysctl |
| rmem_max | 12 MB | sysctl |
| wmem_max | 12 MB | sysctl |
| IRQ affinity (nss-dp-gmac) | CPU 0 | /proc/irq/36,37/smp_affinity |

### Persistence
- `/etc/sysctl.conf` — survives `firewall reload` and reboots (if sysctl init script loads it)
- `uci commit dhcp firewall network` — survives reboots
- `nft list ruleset > /etc/nftables.conf` — firewall ruleset saved

---

## 3. Throughput Baseline (Mac → Internet)

| Test | Result |
|------|--------|
| Ping 8.8.8.8 | 36ms avg, 0% loss |
| Speed (tele2.net, 10MB) | ~10 Mbps (constraint: FPT or server) |
| iperf3 public servers | All timed out (servers offline or blocked) |

iperf3 public servers were unreachable; FPT may block or the servers are offline. Subjective speed unchanged.

---

## 4. ZuneF Proxy Status

- Proxy starts on port 3092 (restart via `zunef-proxy.sh start`)
- Health OK, but API calls return HTTP 401
- Root cause: Zunef token expired or invalid (device ID mismatch between sessions)
- **Not a network issue** — Zunef service auth problem

---

## 5. Remaining Bottlenecks

1. **Cannot install SQM/tc** — no binary, no kmod on IPQ50xx
2. **No irqbalance package** for aarch64_cortex-a53
3. **No WireGuard** — kernel module unavailable
4. **8.8M RX drops on eth1** (17% of packets) — hardware/firmware NSS issue, not configurable
5. **OpenClash** has a broken include path (`/var/etc/openclash.include`) — firewall reload warns but continues

---

## 6. SSH Helper Script

`/tmp/cr8809_ssh.py` — Python pexpect wrapper for CR8809 password SSH. Usage:

```bash
python3 /tmp/cr8809_ssh.py "uci show network"
python3 /tmp/cr8809_ssh.py multi "cmd1" "cmd2" "cmd3"
```

Password: `FastSaaS2026@` (from `.ssh/ssh_cr8809.py` — hardcoded for automation).

---

## 7. Next Steps

- [ ] Get ZuneF token refreshed (device re-auth via `claude.zunef.com`)
- [ ] Test throughput after token fix (401s blocked real measurement)
- [ ] Consider replacing CR8809 with a more powerful router (x86 or MT7621) for full SQM support
- [ ] Fix OpenClash include path if Clash is needed
