---
title: "RTK latency: route Claude Code through Antigravity combos"
description: "Repoint Claude Code model aliases from literal zunef IDs to Antigravity-first combos, then prove p95 and fallback."
status: in_progress
priority: P1
effort: 1.5h
branch: feat/open-core-25-steps-binh-phap-accuracy
tags: [omniroute, claude-code, antigravity, routing, latency]
created: 2026-10-23
---

# RTK latency — plan

## Objective
Move the 95% of `/api/v1/messages` traffic that asks for `zunef/claude-*` onto the existing Antigravity-first combos. Config only: no Omni code, Combo knobs, gateway restart, or ACL change in the default path.

## Evidence (verified 2026-10-23)
- Admission is not the bottleneck: p50 43 ms, peak in-flight 10/26, 0 leases; combo `concurrencyPerModel/maxQueueSize/queueTimeoutMs` inert on priority/task-aware.
- Claude Code currently asks for literal `zunef/claude-opus-5-5`: `~/.claude/settings.json` `.model`, `env.ANTHROPIC_MODEL`, OPUS/SONNET/HAIKU/SMALL/AUTO_MODE, and `fallback-model[]`.
- zunef (`7c069ac1`, max_concurrent 26): p50 53–59 s, p95 255–362 s, max 1743 s; 123k tokens re-prefilled/call (cache_read ~5.7k, cache_creation 0); 264 upstream 429s; 600 s stalls; 90–110 s client aborts.
- Antigravity probe: 1.7 s (`claude-haiku-4-5`), 1.9 s (`claude-opus-5`), HTTP 200, `provider=antigravity`, `account=cashback.mentoring@gmail.com`.
- cashback Ultra ~99% Claude quota; billwill/longtho exhausted until 10-25; `agy` twin `dc96ba4d` (99.74%) is not in any combo ACL.

## Diagnose → config mapping
| File / key | Now | Target | Why |
|---|---|---|---|
| `~/.claude/settings.json` `.model` | `zunef/claude-opus-5-5` | `claude-opus-5` | Default request enters combo ladder |
| `env.ANTHROPIC_MODEL` | `zunef/claude-opus-5-5` | `claude-opus-5` | Overrides `.model` |
| `env.ANTHROPIC_DEFAULT_OPUS_MODEL` | `zunef/claude-opus-5-5` | `claude-opus-5` | `/model opus` alias |
| `env.ANTHROPIC_DEFAULT_SONNET_MODEL` | `zunef/claude-sonnet-5-5` | `claude-sonnet-5-0` | `/model sonnet` alias |
| `env.ANTHROPIC_DEFAULT_HAIKU_MODEL` | `zunef/claude-haiku-4-5` | `claude-haiku-4-5` | Background/title calls |
| `env.ANTHROPIC_SMALL_FAST_MODEL` | `zunef/claude-haiku-4-5` | `claude-haiku-4-5` | Fast path |
| `env.CLAUDE_CODE_AUTO_MODE_MODEL` | `zunef/claude-haiku-4-5` | `claude-haiku-4-5` | Auto mode |
| `fallback-model[]` | two `zunef/*` IDs | `claude-opus-5`, `claude-sonnet-5-0` | Fallback stays inside ladders |

Keep: `ANTHROPIC_DEFAULT_FABLE_MODEL=claude-fable-5` (already a combo) and the current auth token (all-mode `claude-code-main-20261021b`, not the restricted desktop key). `rtk-omni*` combos are already Antigravity-first → no combo edit. If an RTK client pins `zunef/*`, map it to `rtk-omni-fast` (or its `claude-*` equivalent), not to a new ladder.

## Phases
| # | Phase | Goal | Effort |
|---|---|---|---|
| 01 | [diagnose](phase-01-diagnose.md) | Freeze baseline, prove bypass, map every alias | 20m |
| 02 | [config mapping](phase-02-config-mapping.md) | Backup + rewrite 8 settings fields, validate, restart | 20m |
| 03 | [verify](phase-03-verify.md) | Probe, real turn, p95, forced fallback | 35m |
| 04 | [rollback](phase-04-rollback.md) | Restore settings/combo, prove zunef works | 10m |
| 05 | [optional agy ACL](phase-05-optional-agy-acl.md) | Add cashback `agy` twin only if concurrency still caps | 15m |

## Result (2026-10-23T15:06Z)
- Settings remapped; backup `backups/settings.pre-20261023T150513Z.json` (mode 600).
- Real `claude -p --model claude-opus-5` turns: 1.59–2.21 s; call_logs shows `provider=antigravity`, `account=cashback`, `combo_name=claude-opus-5`, duration 1.2–1.8 s.
- `claude-sonnet-5-0` and `claude-haiku-4-5` probes: 1.64 s / 1.24 s, HTTP 200.
- Existing Claude Code sessions still use the old env until restarted; one old in-flight zunef row remained at 15:05:25Z.
- Forced zunef fallback drill deferred (would intentionally hit the 35 s+ path).

## Acceptance
- A real Claude Code turn logs `provider=antigravity`, `account=cashback.mentoring@gmail.com`, duration <60 s; no first-attempt zunef.
- 20 consecutive turns: p95 ≤60 s (baseline 255–362 s), 0 calls >120 s, ≥90% first attempts on Antigravity.
- Fallback drill: Antigravity ACL restricted to exhausted Ultra IDs → request still 200 via zunef; combo restored immediately.
- `jq empty ~/.claude/settings.json` passes; diff touches only the 8 mapped fields (+ timestamped backup).

## Risks & rollback
- **Settings format**: JSON is rewritten by `jq`; validate before `mv`, keep `.bak-rtk-latency-<ts>`.
- **Session restart**: env is read at process start; existing Claude Code sessions keep the old model until restarted.
- **Quota burn**: all Claude traffic now hits cashback Ultra; watch quota after 20 turns and stop on <10%.
- **Fallback still slow**: zunef remains last rung; acceptance measures first-attempt rate separately.
- **`[1m]` variant**: if Claude Code appends `[1m]`, stop and map to an existing `[1m]` combo; do not invent one.
- Rollback = restore backup + restart; no DB migration, no gateway restart.

## Non-goals / unresolved
- No Omni code, provider concurrency, queue knob, or hedging changes; measure first.
- If the `agy` twin is added, only its ACL changes; no new combo strategy.
- Open: whether RTK's client-side pin lives outside `~/.claude` (Phase 01 scans shell/env/OpenCode/Codex configs).
- Open: why the active Omni DB file reports 0 `combos` while `/api/combos` returns 51; API is treated as source of truth.
