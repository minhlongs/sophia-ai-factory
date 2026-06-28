# CLAUDE.deploy.md — Deploy Phase Contract
# Version: 1.0.0 | Updated: 2026-04-16
# For Agent: tester | Input: .mekong/TASKS.todo | Output: .mekong/DEPLOY_REPORT.md

## Role

You are the **tester** agent. Your job is to verify the feature is ready to ship:
run smoke tests, check CI gates, validate metrics, then emit a deploy report.

## Input

Read `.mekong/TASKS.todo` before proceeding.
If file missing, halt and print: "Run `mekong code <feature>` first."
Also read `.mekong/SPEC_OUTPUT.md` to verify success criteria coverage.

## CI Gate Verification (MANDATORY — do not skip)

Check GitHub Actions status via `gh run list -L 1 --json status,conclusion`.
All 5 gates defined in `.github/workflows/gates.yml` MUST be green:

| Gate Job ID        | Name            | Checks                                        |
|--------------------|-----------------|-----------------------------------------------|
| `g1-validation`    | G1 Validation   | ruff lint, pyright, pytest unit tests ≥40% cov |
| `g2-security`      | G2 Security     | bandit, semgrep, trivy                        |
| `g3-quality`       | G3 Quality      | pytest coverage ≥40%, vitest                  |
| `g4-dep-audit`     | G4 Dep Audit    | osv-scanner, pnpm audit                       |
| `g5-deploy-ready`  | G5 Deploy Ready | wrangler config exists, smoke placeholder     |
| `merge-gate`       | Merge Gate      | aggregator — all above must pass              |

If ANY gate is red: halt, print gate name + error, do NOT write DEPLOY_REPORT.md.
If gates are still running: wait up to 5 min (poll every 30s), then timeout with error.

Command to check:
```bash
gh run list -L 1 --json status,conclusion,name \
  --workflow=gates.yml -q '.[0] | [.name, .status, .conclusion] | @csv'
```

## Metric Baseline Check

After gates pass, verify these metric names exist in instrumented code
(defined in `src/core/telemetry/meters.py`):

- `agent.invocation_ms` — confirm feature's agent boundary is instrumented
- `agent.token_cost_usd` — confirm token cost is tracked if LLM is called
- `agent.retry_total` — confirm retry logic increments this counter
- `mlx.gpu_utilization_percent` — confirm GPU probe is running (M1 Max only)
- `agent.model_drift_score` — note if offline baseline was updated

Run `mekong metrics` (phase-03 command) after deploy to confirm live data flows.
Run `mekong eval-agent <feature-slug> --days 1` to verify first mission events.

## Smoke Tests

Execute each smoke test. Mark result inline: [PASS] / [FAIL] / [SKIP-reason].

```
[ ] Feature command responds without error (exit 0)
[ ] Feature writes expected output file (check path from TASKS.todo)
[ ] No new `@ts-ignore` or `# type: ignore` introduced (grep check)
[ ] No secrets or API keys in output files (grep for KEY|SECRET|TOKEN)
[ ] `python3 -m pytest tests/ -q --tb=short` exits 0
[ ] `ruff check src/` exits 0
[ ] mekong metrics — shows updated row count (if mission event emitted)
[ ] mekong eval-agent <slug> — returns data (if mission event emitted)
```

## Rollback Plan

Document before writing DEPLOY_REPORT.md:

1. **Revert commit**: `git revert HEAD` (no force — create revert commit)
2. **Feature flag**: if feature is behind a flag, name it here: `__________`
3. **Data migration**: if SQLite schema changed, list rollback SQL here
4. **Notify**: solo = self. No pager needed.

## Output Contract

Write `.mekong/DEPLOY_REPORT.md` using the template at
`.mekong/phases/templates/DEPLOY_OUTPUT.template.md`.

Required sections:
1. Feature slug + timestamp
2. Gate results table (g1..g5 + merge-gate) — actual status from `gh run list`
3. Smoke test results (all 8 items, marked PASS/FAIL/SKIP)
4. Metric verification table (5 metrics from meters.py)
5. Rollback plan (filled in, not template)
6. Deploy verdict: SHIP / HOLD (HOLD if any gate red or smoke FAIL)
7. Post-deploy checklist:
   - [ ] Run `mekong eval-agent <slug>` after 24h
   - [ ] Check `mekong metrics --days 1` for anomalies
   - [ ] Update `.mekong/SPEC_OUTPUT.md` success criteria with actual baseline

## Agent Rules

- Never skip gate checks — gates are the contract with CI
- Never write DEPLOY_REPORT.md with verdict SHIP if any gate is red
- Prefer SKIP over FAIL for smoke tests that require running infra not present locally
- SKIP must include reason: `[SKIP: PostHog not running locally]`
- If TASKS.todo has unchecked items, note them in report but do not block SHIP
  (solo may ship with known-incomplete tasks if gates are green)

## Invocation Context

This contract is executed by `mekong deploy <feature>`.
Prior phase output: `.mekong/TASKS.todo`
This is the final phase — output is DEPLOY_REPORT.md.
